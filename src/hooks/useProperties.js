import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { mockProperties } from '../data/mockProperties';
import { geocodeAddress, cacheWarmPromise, memCache } from '../utils/geocode';
import { authorizeAndFetch, revokeToken, fetchWithApiKey, updateSheetRowValues, buildSheetRow } from '../utils/googleSheets';
import { optimizeRoute } from '../utils/routeOptimizer';

const GOOGLE_SHEET_CSV_URL = '';

// ─────────────────────────────────────────────
// 숫자 파싱 (콤마, 단위 처리)
// ─────────────────────────────────────────────
function parseNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/\uFEFF/g, '').trim();
  const cleaned = s.replace(/[^0-9.-]+/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// ─────────────────────────────────────────────
// 헤더 정규화 (구글시트 컬럼명 → 내부 필드명)
// 헤더에 포함된 \n 등 공백문자는 transformHeader에서 미리 제거됩니다.
// ─────────────────────────────────────────────
const HEADER_CANONICAL = {
  // 이 시트 전용 컬럼명
  '순번': 'id',
  '접수': 'receivedDate',
  '상태': 'rawState',       // 생/완/청우/취소 등 — 별도 보존
  '구역': 'zone',
  '상호명': 'statusOrName', // 업체명 or '공실'
  '동': 'dong',
  '번지': 'bunji',
  '건물명': 'buildingName',
  '층': 'floor',
  '호': 'unit',
  '총층': 'totalFloors',
  '전용': 'areaExclusive',
  '공급': 'areaSupply',
  '보증금': 'deposit',
  '월세': 'rent',
  '권리': 'premium',
  '관리': 'maintenanceFee',
  '식당': 'hasRestaurant',
  '습': 'humidity',
  '화장실': 'bathroomType',
  '차': 'parking',
  '엘베': 'hasElevator',
  '임차인연락처': 'contactTenant',
  '경로': 'directions',
  '소유자': 'ownerName',
  '광고': 'advertising',
  '임대인연락처': 'contactOwner',
  '확인': 'confirmedDate',
  '담당': 'manager',
  // 기존 호환
  '접수일': 'receivedDate',
  '상호명/상태': 'statusOrName',
  '상호 / 상태': 'statusOrName',
  '주소': 'address',
  '도로명주소': 'address',
  '지번주소': 'address',
  '층수': 'floor',
  '전용면적': 'areaExclusive',
  '면적': 'areaExclusive',
  '권리금': 'premium',
  '관리비': 'maintenanceFee',
  '위도': 'lat',
  '경도': 'lng',
  '유형': 'type',
  '공실여부': 'isVacantRaw',
  '임차인\n연락처': 'contactTenant',
  '임대인\n연락처': 'contactOwner',
};

function canonicalKey(orig) {
  if (!orig && orig !== 0) return orig;
  // \n, \r, 공백 제거 후 매핑
  const s = String(orig).replace(/\uFEFF/g, '').replace(/[\n\r]+/g, '').trim();
  const base = s.replace(/(_\d+$|\(\d+\)$|\s+\d+$)/, '').trim();
  if (HEADER_CANONICAL[base]) return HEADER_CANONICAL[base];
  // 비고로 시작하는 긴 컬럼명
  if (base.startsWith('비고')) return 'notes';
  const lower = base.toLowerCase();
  const fallbackMap = { receiveddate: 'receivedDate', zone: 'zone' };
  if (fallbackMap[lower]) return fallbackMap[lower];
  return base;
}

function normalizeRowObject(row) {
  const out = {};
  for (const k of Object.keys(row)) {
    const canonical = canonicalKey(k);
    const val = row[k];
    if (out[canonical] === undefined || out[canonical] === '' || out[canonical] === null) {
      out[canonical] = val;
    } else if ((canonical === 'address' || canonical === 'notes') && val) {
      out[canonical] = [out[canonical], val].filter(Boolean).join(' / ');
    }
  }
  return out;
}

function boolFromYO(v) {
  if (!v) return false;
  const s = String(v).trim().toLowerCase();
  return s === 'ㅇ' || s === 'o' || s === 'y' || s === '예' || s === '있음';
}

function mapRowToProperty(row, idx) {
  const r = row || {};

  // 원본 상태값 (생/완/청우/취소 등)
  const rawState = (r.rawState || '').trim();

  // 업체명 or 공실
  const businessName = (r.statusOrName || '').trim();

  // 완료: 상태 = 완 or 완료
  const isCompleted = ['완', '완료'].includes(rawState);

  // 취소/청우
  const isCancelled = ['취소', '청우'].includes(rawState);

  // 공실: 업체명에 '공실' 포함 또는 상태='공'
  const isVacant =
    rawState === '공' ||
    businessName === '공실' ||
    businessName.startsWith('공실') ||
    (r.isVacantRaw === 'Y' || r.isVacantRaw === '공실');

  // ─ 주소 구성: 동 + 번지 (인천/부천 지역)
  const dong = (r.dong || '').trim();
  const bunji = (r.bunji || '').trim();
  const buildingName = (r.buildingName || '').trim();
  // 기존 address 컬럼이 있으면 우선 사용, 없으면 시 + 동 + 번지로 구성
  const addressFromSheet = (r.address || '').trim();
  const cityPrefix = BUCHEON_DONGS.has(dong) ? '부천시' : '인천';
  const addressBuilt = dong && bunji ? `${cityPrefix} ${dong} ${bunji}` : dong ? `${cityPrefix} ${dong}` : '';
  const address = addressFromSheet || addressBuilt;

  // 층 파싱
  const floorRaw = String(r.floor || '').trim();
  const floorMatch = floorRaw.match(/^(-?\d+)/);
  const floor = floorMatch ? floorMatch[1] : floorRaw;

  // ID (순번)
  const idNum = parseNumber(r.id);

  return {
    id: (idNum > 0 ? idNum : null) || idx + 1,
    _rowNum: idx + 2,
    receivedDate: (r.receivedDate || '').trim(),
    rawState,
    zone: (r.zone || '').trim(),
    statusOrName: businessName || (isVacant ? '공실' : ''),
    dong,
    bunji,
    buildingName,
    address,
    floor,
    unit: (r.unit || '').trim(),
    totalFloors: (r.totalFloors || '').trim(),
    areaExclusive: parseNumber(r.areaExclusive || 0),
    areaSupply: parseNumber(r.areaSupply || 0),
    deposit: parseNumber(r.deposit || 0),
    rent: parseNumber(r.rent || 0),
    premium: parseNumber(r.premium || 0),
    maintenanceFee: parseNumber(r.maintenanceFee || 0),
    hasRestaurant: boolFromYO(r.hasRestaurant),
    bathroomType: (r.bathroomType || '').trim(),
    parking: boolFromYO(r.parking),
    hasElevator: boolFromYO(r.hasElevator),
    notes: (r.notes || '').trim(),
    contactTenant: (r.contactTenant || '').trim(),
    directions: (r.directions || '').trim(),
    ownerName: (r.ownerName || '').trim(),
    advertising: (r.advertising || '').trim(),
    contactOwner: (r.contactOwner || '').trim(),
    confirmedDate: (r.confirmedDate || '').trim(),
    manager: (r.manager || '').trim(),
    lat: r.lat ? parseFloat(r.lat) : (r['위도'] ? parseFloat(r['위도']) : null),
    lng: r.lng ? parseFloat(r.lng) : (r['경도'] ? parseFloat(r['경도']) : null),
    type: r.type || r['유형'] || '임대',
    isVacant,
    isCompleted,
    isCancelled,
  };
}

// ─── 빠른 대체 좌표 생성 — lat/lng 없는 항목에 즉시 표시용 좌표를 할당합니다.
function computeApproxPositions(props) {
  if (!Array.isArray(props) || props.length === 0) return props;
  const out = props.map(p => ({ ...p }));

  // dong 단위로 이미 존재하는 좌표의 중심 계산
  const centersByDong = {};
  for (const p of out) {
    if (Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.dong) {
      const k = String(p.dong).trim();
      if (!k) continue;
      if (!centersByDong[k]) centersByDong[k] = { lat: 0, lng: 0, count: 0 };
      centersByDong[k].lat += p.lat;
      centersByDong[k].lng += p.lng;
      centersByDong[k].count += 1;
    }
  }
  Object.keys(centersByDong).forEach(k => {
    const c = centersByDong[k];
    c.lat = c.lat / c.count;
    c.lng = c.lng / c.count;
  });

  // 전역 중심
  const known = out.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  let globalLat = 37.502;
  let globalLng = 126.722;
  if (known.length) {
    globalLat = known.reduce((s, p) => s + p.lat, 0) / known.length;
    globalLng = known.reduce((s, p) => s + p.lng, 0) / known.length;
  }

  // 간단한 의사난수 기반 지터 — 겹침을 줄이기 위함
  const jitter = (i, scale = 0.00045) => {
    const seed = (i * 9301 + 49297) % 233280;
    const r = seed / 233280;
    const ang = r * Math.PI * 2;
    const rad = (0.5 + (r % 0.5)) * scale;
    return [Math.cos(ang) * rad, Math.sin(ang) * rad];
  };

  for (let i = 0; i < out.length; i++) {
    const p = out[i];
    // 이미 실좌표가 있고 approxLocation 플래그가 없으면 건너뜀
    if (Number.isFinite(p.lat) && Number.isFinite(p.lng) && !p.approxLocation) continue;

    // 캐시가 있으면 즉시 적용
    if (p.address && memCache.has(p.address)) {
      const c = memCache.get(p.address);
      if (c?.lat && c?.lng) {
        p.lat = c.lat; p.lng = c.lng; p.approxLocation = false; continue;
      }
    }

    const dongKey = p.dong ? String(p.dong).trim() : '';
    let baseLat = globalLat, baseLng = globalLng;
    if (dongKey && centersByDong[dongKey]) {
      baseLat = centersByDong[dongKey].lat;
      baseLng = centersByDong[dongKey].lng;
    }
    const [dx, dy] = jitter(i);
    p.lat = baseLat + dx;
    p.lng = baseLng + dy;
    p.approxLocation = true;
  }
  return out;
}

// ─────────────────────────────────────────────
// 지역 분류 — 동 → 시/구 매핑
// ─────────────────────────────────────────────
const BUCHEON_DONGS = new Set([
  '상동', '중동', '원미동', '소사동', '약대동', '춘의동', '도당동',
  '옥길동', '계수동', '항동', '여월동', '고강동', '오정동', '내동',
  '삼정동', '작동', '범박동', '괴안동', '송내동', '심곡동', '역곡동',
  '소사본동', '중1동', '중2동', '중3동', '중4동', '중5동',
]);

const BUPYEONG_DONGS = new Set([
  '부평동', '삼산동', '갈산동', '산곡동', '청천동', '부개동',
  '일신동', '십정동', '작전동', '서운동', '효성동', '구산동',
]);

const GYEYANG_DONGS = new Set([
  '계산동', '임학동', '용종동', '박촌동', '동양동', '병방동', '귤현동',
  '갈현동', '오류동', '이화동', '평동', '방축동', '장기동', '서운동',
]);

const SEO_DONGS = new Set([
  '가좌동', '신현동', '검암동', '경서동', '청라동', '연희동',
  '공촌동', '원당동', '당하동', '마전동', '금곡동', '대곡동',
  '불로동', '시천동', '백석동', '오류동', '심곡동',
]);

export function getDongRegion(dong) {
  if (!dong) return null;
  if (BUCHEON_DONGS.has(dong)) return '부천시';
  if (BUPYEONG_DONGS.has(dong)) return '부평구';
  if (GYEYANG_DONGS.has(dong)) return '계양구';
  if (SEO_DONGS.has(dong)) return '서구';
  return '인천시';
}

// ─────────────────────────────────────────────
export function useProperties() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sheetMeta, setSheetMeta] = useState(null);

  const DEFAULT_FILTERS = {
    searchTerm: '',
    zone: '전체',
    region: '전체',
    categories: ['임대','매매','공실'],
    isVacantOnly: false,
    type: '전체',
    showCompleted: false,
    depositMin: null,
    depositMax: null,
    rentMin: null,
    rentMax: null,
    premiumMax: null,
    manager: '전체',
    areaMin: null,
    areaMax: null,
  };

  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem('re_filters_v1');
      if (saved) return { ...DEFAULT_FILTERS, ...JSON.parse(saved) };
    } catch { /* ignore */ }
    return DEFAULT_FILTERS;
  });

  const [routeSelection, setRouteSelection] = useState([]);
  const [geocoding, setGeocoding] = useState({ running: false, total: 0, done: 0 });
  const autoGeocodeDoneRef = useRef(false);
  const cancelGeocodeRef = useRef(false);
  const [googleUser, setGoogleUser] = useState(null);
  const [googleToken, setGoogleToken] = useState(null);

  // Kakao SDK 준비 상태 (주소 검색 시작 트리거)
  const [kakaoReady, setKakaoReady] = useState(
    () => typeof window !== 'undefined' && !!(window.kakao?.maps?.services)
  );
  useEffect(() => {
    if (kakaoReady) return;
    const onReady = () => setKakaoReady(!!(window.kakao?.maps?.services));
    window.addEventListener('kakao-sdk-ready', onReady);
    return () => window.removeEventListener('kakao-sdk-ready', onReady);
  }, [kakaoReady]);

  // propertiesRef for stable access inside callbacks
  const propertiesRef = useRef(properties);
  useEffect(() => { propertiesRef.current = properties; }, [properties]);

  // 로딩 시 구글시트에 특정 상태값(rawState)이 해당되는 행을 제외
  const EXCLUDE_RAW_STATES = ['완', '완료', '청우', '취소'];
  function filterExcludedItems(items) {
    if (!Array.isArray(items)) return items;
    return items.filter((p) => {
      const state = String(p.rawState || '').trim();
      return !EXCLUDE_RAW_STATES.includes(state);
    });
  }

  // ─── 데이터 로드 ───
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const spreadsheetId = import.meta.env.VITE_SPREADSHEET_ID || '16urMn_RdMuw99MLpvASHG07h5EuKsCESc25-CcGH9Lo';
        const sheetGid = import.meta.env.VITE_SHEET_GID || '162008221';

        // 헬퍼: CSV 텍스트 → properties 변환
        const parseCsv = async (csvText) => {
          const { default: Papa } = await import('papaparse');
          const { data, meta } = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => (h ? String(h).replace(/\uFEFF/g, '').replace(/[\n\r]+/g, '').trim() : h),
          });
          const headers = meta.fields || Object.keys(data[0] || {});
          const normalized = data.map(normalizeRowObject);
          const mapped = normalized.map(mapRowToProperty);
          const filtered = filterExcludedItems(mapped);
          return { items: computeApproxPositions(filtered), headers };
        };

        // 1순위: GitHub Actions가 빌드 시 pre-bake한 정적 CSV (빠름, CORS 없음)
        const staticCsvUrl = `${import.meta.env.BASE_URL || '/'}sheet-data.csv`.replace(/\/\//g, '/');
        try {
          const staticRes = await fetch(staticCsvUrl);
          if (staticRes.ok) {
            const csvText = await staticRes.text();
            if (csvText && csvText.trim().length > 30) {
              const { items, headers } = await parseCsv(csvText);
              if (items.length > 0) {
                setProperties(items);
                setSheetMeta({ spreadsheetId, sheetTitle: null, headers, source: 'static' });
                setError(null);
                return;
              }
            }
          }
        } catch {
          console.info('[useProperties] 정적 CSV 없음 → 구글 시트 직접 조회');
        }

        // 2순위: 구글 시트 공개 CSV (라이브 데이터)
        const csvUrl =
          GOOGLE_SHEET_CSV_URL ||
          `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${sheetGid}`;

        try {
          const tryRes = await fetch(csvUrl);
          if (tryRes.ok) {
            const csvText = await tryRes.text();
            const { items, headers } = await parseCsv(csvText);
            setProperties(items);
            setSheetMeta({ spreadsheetId, sheetTitle: null, headers, source: 'live' });
            setError(null);
            return;
          }
        } catch (eCsv) {
          console.warn('public CSV fetch failed', eCsv);
        }
        console.info('[useProperties] 공개 CSV 접근 불가 → 목업 데이터 사용');
        setProperties(mockProperties);
      } catch (err) {
        setError(err?.message || String(err));
        setProperties(mockProperties);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // ─── Google 연동 ───
  const connectGoogle = useCallback(async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    const spreadsheetId = import.meta.env.VITE_SPREADSHEET_ID || '16urMn_RdMuw99MLpvASHG07h5EuKsCESc25-CcGH9Lo';
    const sheetGid = import.meta.env.VITE_SHEET_GID || '162008221';
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || '';
    autoGeocodeDoneRef.current = false; // 재연동 시 지오코딩 재실행
    setLoading(true);
    try {
      try {
        const publicCsvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${sheetGid}`;
        const res = await fetch(publicCsvUrl);
        if (res.ok) {
          const { default: Papa } = await import('papaparse');
          const csvText = await res.text();
          const { data, meta } = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => (h ? String(h).replace(/\uFEFF/g, '').replace(/[\n\r]+/g, '').trim() : h),
          });
          const headers = meta.fields || [];
            const normalized = data.map(normalizeRowObject);
            const mapped = normalized.map(mapRowToProperty);
            const filtered = filterExcludedItems(mapped);
            setProperties(computeApproxPositions(filtered));
          setSheetMeta({ spreadsheetId, sheetTitle: null, headers });
          setGoogleUser(null);
          setGoogleToken(null);
          setError(null);
          return { user: null, mapped };
        }
      } catch (eCsv) {
        console.warn('public CSV failed in connectGoogle', eCsv);
      }

      if (apiKey) {
        try {
          const { rows, title } = await fetchWithApiKey(spreadsheetId, sheetGid, apiKey);
          const normalized = rows.map(normalizeRowObject);
          const mapped = normalized.map(mapRowToProperty);
          const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
          const filtered = filterExcludedItems(mapped);
          setProperties(computeApproxPositions(filtered));
          setSheetMeta({ spreadsheetId, sheetTitle: title, headers });
          setGoogleUser(null);
          setGoogleToken(null);
          setError(null);
          return { user: null, mapped };
        } catch (eApi) {
          console.warn('API Key 실패, OAuth 시도:', eApi.message || eApi);
        }
      }

      const { rows, user, token, title } = await authorizeAndFetch(spreadsheetId, sheetGid, clientId);
      const normalized = rows.map(normalizeRowObject);
      const mapped = normalized.map(mapRowToProperty);
      const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
      const filtered = filterExcludedItems(mapped);
      setProperties(computeApproxPositions(filtered));
      setSheetMeta({ spreadsheetId, sheetTitle: title, headers });
      setGoogleUser(user || null);
      setGoogleToken(token || null);
      setError(null);
      return { user, mapped };
    } catch (err) {
      setError(err?.message || String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnectGoogle = useCallback(() => {
    try { if (googleToken) revokeToken(googleToken); } catch { /* ignore */ }
    setGoogleUser(null);
    setGoogleToken(null);
  }, [googleToken]);

  // ─── 매물 수정 ───
  const updateProperty = useCallback(async (id, patch) => {
    setProperties((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

    if (googleToken && sheetMeta?.sheetTitle && sheetMeta?.headers) {
      try {
        const currentProp = propertiesRef.current.find((p) => p.id === id);
        if (!currentProp || !currentProp._rowNum) return;
        const updated = { ...currentProp, ...patch };
        const rowValues = buildSheetRow(sheetMeta.headers, updated);
        await updateSheetRowValues(
          sheetMeta.spreadsheetId,
          sheetMeta.sheetTitle,
          currentProp._rowNum,
          rowValues,
          googleToken
        );
      } catch (e) {
        console.warn('[Sheets] 행 업데이트 실패:', e.message);
      }
    }
  }, [googleToken, sheetMeta]);

  const completeProperty = useCallback(async (id) => {
    await updateProperty(id, { statusOrName: '완료매물', isCompleted: true });
  }, [updateProperty]);

  const uncompleteProperty = useCallback(async (id, originalStatus) => {
    await updateProperty(id, { statusOrName: originalStatus || '매물', isCompleted: false });
  }, [updateProperty]);

  // ─── 경로 선택 ───
  const toggleRouteSelection = useCallback((id) => {
    setRouteSelection((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }, []);

  const clearRouteSelection = useCallback(() => setRouteSelection([]), []);

  const routeResult = useMemo(() => {
    if (routeSelection.length < 2) return null;
    const selected = properties.filter((p) => routeSelection.includes(p.id));
    return optimizeRoute(selected);
  }, [routeSelection, properties]);

  // ─── 지오코딩: Kakao SDK 준비 & 데이터 로드 시 자동 실행 ───
  useEffect(() => {
    if (!kakaoReady || properties.length === 0 || autoGeocodeDoneRef.current) return;
    autoGeocodeDoneRef.current = true;
    cancelGeocodeRef.current = false;

    (async () => {
      // 1단계: IndexedDB 웜업 완료 대기 (거의 즉시)
      await cacheWarmPromise;

      // 2단계: 이미 캐시된 주소 → 즉시 적용 (API 호출 없음)
      const cachedUpdates = {};
      for (const p of properties) {
        if (Number.isFinite(p.lat) && Number.isFinite(p.lng) && !p.approxLocation) continue;
        if (!p.address) continue;
        const cached = memCache.get(p.address);
        if (cached) cachedUpdates[p.id] = cached;
      }
      if (Object.keys(cachedUpdates).length > 0) {
        setProperties(prev => prev.map(it =>
          cachedUpdates[it.id]
            ? { ...it, lat: cachedUpdates[it.id].lat, lng: cachedUpdates[it.id].lng, approxLocation: false }
            : it
        ));
      }

      // 3단계: 캐시 미스 주소만 실제 지오코딩
      const addrMap = new Map();
      for (const p of properties) {
        if (Number.isFinite(p.lat) && Number.isFinite(p.lng) && !p.approxLocation) continue;
        if (!p.address || memCache.has(p.address)) continue;
        if (!addrMap.has(p.address)) addrMap.set(p.address, []);
        addrMap.get(p.address).push(p.id);
      }
      const uniqueEntries = [...addrMap.entries()];
      if (uniqueEntries.length === 0) {
        setGeocoding({ running: false, total: 0, done: 0 });
        return;
      }

      setGeocoding({ running: true, total: uniqueEntries.length, done: 0 });
      let done = 0;
      const CONCURRENCY = 12; // Kakao는 in-browser API → 높은 동시성 OK

      for (let i = 0; i < uniqueEntries.length; i += CONCURRENCY) {
        if (cancelGeocodeRef.current) break;
        const chunk = uniqueEntries.slice(i, i + CONCURRENCY);

        const results = await Promise.all(
          chunk.map(async ([addr, ids]) => {
            try { return { ids, geo: await geocodeAddress(addr) }; }
            catch { return { ids, geo: null }; }
          })
        );

        const batchMap = {};
        for (const { ids, geo } of results) {
          if (geo) for (const id of ids) batchMap[id] = geo;
        }
        if (Object.keys(batchMap).length > 0) {
          setProperties(prev => prev.map(it =>
            batchMap[it.id]
              ? { ...it, lat: batchMap[it.id].lat, lng: batchMap[it.id].lng, approxLocation: batchMap[it.id].approxLocation || false }
              : it
          ));
        }

        done += chunk.length;
        setGeocoding({ running: true, total: uniqueEntries.length, done });
        // 딜레이 없음 — Kakao SDK가 자체 rate-limit 처리
      }
      setGeocoding({ running: false, total: uniqueEntries.length, done: uniqueEntries.length });
    })();

    return () => { cancelGeocodeRef.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kakaoReady, properties.length]);

  // ─── 필터링 ───
  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      // 카테고리 기반 필터 우선: filters.categories 배열이 있으면 그것을 사용
      const cats = Array.isArray(filters.categories) && filters.categories.length > 0 ? filters.categories : null;
      if (cats) {
        if (p.isCompleted) {
          if (!cats.includes('완료')) return false;
        } else {
          if (p.isVacant) {
            if (!cats.includes('공실')) return false;
          } else if (p.type === '매매') {
            if (!cats.includes('매매')) return false;
          } else {
            if (!cats.includes('임대')) return false;
          }
        }
      } else {
        // 레거시 동작: showCompleted/isVacantOnly/type 사용
        if (p.isCompleted && !filters.showCompleted) return false;
        if (filters.isVacantOnly && !p.isVacant) return false;
        if (filters.type && filters.type !== '전체' && p.type !== filters.type) return false;
      }

      const term = (filters.searchTerm || '').toLowerCase();
      const matchSearch =
        !term ||
        (p.statusOrName || '').toLowerCase().includes(term) ||
        (p.address || '').toLowerCase().includes(term) ||
        (p.zone || '').toLowerCase().includes(term) ||
        (p.buildingName || '').toLowerCase().includes(term) ||
        (p.notes || '').toLowerCase().includes(term);

      const matchZone = filters.zone === '전체' || p.zone === filters.zone;
      const matchRegion = (() => {
        const r = filters.region || '전체';
        if (r === '전체') return true;
        const dong = p.dong || '';
        if (r === '부천시') return BUCHEON_DONGS.has(dong);
        if (r === '인천시') return !BUCHEON_DONGS.has(dong);
        if (r === '부평구') return BUPYEONG_DONGS.has(dong);
        if (r === '계양구') return GYEYANG_DONGS.has(dong);
        if (r === '서구')   return SEO_DONGS.has(dong);
        return true;
      })();
      const matchDepositMin = !filters.depositMin || p.deposit >= Number(filters.depositMin);
      const matchDepositMax = !filters.depositMax || p.deposit <= Number(filters.depositMax);
      const matchRentMin = !filters.rentMin || p.rent >= Number(filters.rentMin);
      const matchRentMax = !filters.rentMax || p.rent <= Number(filters.rentMax);
      const matchPremiumMax = !filters.premiumMax || p.premium <= Number(filters.premiumMax);
      const matchManager = !filters.manager || filters.manager === '전체' || p.manager === filters.manager;
      const matchAreaMin = !filters.areaMin || p.areaExclusive >= Number(filters.areaMin);
      const matchAreaMax = !filters.areaMax || p.areaExclusive <= Number(filters.areaMax);

      return (
        matchSearch && matchZone && matchRegion &&
        matchDepositMin && matchDepositMax && matchRentMin && matchRentMax && matchPremiumMax &&
        matchManager && matchAreaMin && matchAreaMax
      );
    });
  }, [properties, filters]);

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem('re_filters_v1', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    try { localStorage.removeItem('re_filters_v1'); } catch { /* ignore */ }
    setFilters({
      searchTerm: '',
      zone: '전체',
      region: '전체',
      categories: ['임대', '매매', '공실'],
      isVacantOnly: false,
      type: '전체',
      showCompleted: false,
      depositMin: null,
      depositMax: null,
      rentMin: null,
      rentMax: null,
      premiumMax: null,
      manager: '전체',
      areaMin: null,
      areaMax: null,
    });
  }, []);

  const zones = useMemo(() => {
    const set = new Set(properties.map((p) => p.zone).filter(Boolean));
    return ['전체', ...Array.from(set).sort()];
  }, [properties]);

  const managers = useMemo(() => {
    const set = new Set(properties.map((p) => p.manager).filter(Boolean));
    return Array.from(set).sort();
  }, [properties]);

  return {
    properties,
    filteredProperties,
    loading,
    error,
    filters,
    zones,
    managers,
    updateFilter,
    resetFilters,
    connectGoogle,
    disconnectGoogle,
    googleUser,
    googleToken,
    sheetMeta,
    geocoding,
    updateProperty,
    completeProperty,
    uncompleteProperty,
    routeSelection,
    toggleRouteSelection,
    clearRouteSelection,
    routeResult,
  };
}

