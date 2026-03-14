import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { mockProperties } from '../data/mockProperties';
import { geocodeAddress } from '../utils/geocode';
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
// 헤더 정규화
// ─────────────────────────────────────────────
const HEADER_CANONICAL = {
  '접수일': 'receivedDate',
  '구역': 'zone',
  '상호명/상태': 'statusOrName',
  '상호명': 'statusOrName',
  '상호 / 상태': 'statusOrName',
  '상태': 'statusOrName',
  '주소': 'address',
  '도로명주소': 'address',
  '지번주소': 'address',
  '건물명': 'buildingName',
  '층수': 'floor',
  '층': 'floor',
  '전용면적': 'areaExclusive',
  '면적': 'areaExclusive',
  '보증금': 'deposit',
  '월세': 'rent',
  '권리금': 'premium',
  '관리비': 'maintenanceFee',
  '위도': 'lat',
  '경도': 'lng',
  '유형': 'type',
  '공실여부': 'isVacant',
  '비고': 'notes',
  '임차인연락처': 'contactTenant',
  '임대인연락처': 'contactOwner',
};

function canonicalKey(orig) {
  if (!orig && orig !== 0) return orig;
  const s = String(orig).replace(/\uFEFF/g, '').trim();
  const base = s.replace(/(_\d+$|\(\d+\)$|\s+\d+$)/, '').trim();
  if (HEADER_CANONICAL[base]) return HEADER_CANONICAL[base];
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
    } else if ((canonical === 'address' || canonical === 'notes' || canonical === 'statusOrName') && val) {
      out[canonical] = [out[canonical], val].filter(Boolean).join(' / ');
    }
  }
  return out;
}

function mapRowToProperty(row, idx) {
  const r = row || {};
  const rawStatus = r.statusOrName || r['상호명/상태'] || r['상호명'] || r['상태'] || '';
  const statusTokens = String(rawStatus).split(/[\s/(),]+/).map((t) => t.trim()).filter(Boolean);
  const isCompleted = statusTokens.some((t) => ['완', '완료', '완료매물', '완료(매물)'].includes(t));

  return {
    id: r.id || r.ID || idx + 1,
    _rowNum: idx + 2,
    receivedDate: r.receivedDate || r['접수일'] || '',
    zone: r.zone || r['구역'] || '',
    statusOrName: isCompleted ? '완료매물' : (r.statusOrName || r['상호명/상태'] || r['상호명'] || r['상호 / 상태'] || ''),
    isCompleted,
    address: r.address || r['주소'] || '',
    buildingName: r.buildingName || r['건물명'] || '',
    floor: (() => {
      const f = r.floor || r['층수'] || '';
      if (!f) return '';
      const m = String(f).match(/(-?\d+)(층)?/);
      return m ? m[1] : String(f);
    })(),
    areaExclusive: parseNumber(r.areaExclusive || r['전용면적'] || 0),
    deposit: parseNumber(r.deposit || r['보증금'] || 0),
    rent: parseNumber(r.rent || r['월세'] || 0),
    premium: parseNumber(r.premium || r['권리금'] || 0),
    maintenanceFee: parseNumber(r.maintenanceFee || r['관리비'] || 0),
    lat: r.lat ? parseFloat(r.lat) : (r['위도'] ? parseFloat(r['위도']) : null),
    lng: r.lng ? parseFloat(r.lng) : (r['경도'] ? parseFloat(r['경도']) : null),
    type: r.type || r['유형'] || '임대',
    isVacant:
      (r.isVacant === 'Y') || (r.isVacant === '공실') || (r['공실여부'] === '공실') || (r['공실여부'] === 'Y') || r.isVacant === true,
    notes: r.notes || r['비고'] || '',
    contactTenant: r.contactTenant || r['임차인연락처'] || '',
    contactOwner: r.contactOwner || r['임대인연락처'] || '',
  };
}

// ─────────────────────────────────────────────
// 메인 훅
// ─────────────────────────────────────────────
export function useProperties() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sheetMeta, setSheetMeta] = useState(null);

  const [filters, setFilters] = useState({
    searchTerm: '',
    zone: '전체',
    isVacantOnly: false,
    type: '전체',
    showCompleted: false,
    depositMin: null,
    depositMax: null,
    rentMin: null,
    rentMax: null,
    premiumMax: null,
  });

  const [routeSelection, setRouteSelection] = useState([]);
  const [geocoding, setGeocoding] = useState({ running: false, total: 0, done: 0 });
  const autoGeocodeDoneRef = useRef(false);
  const cancelGeocodeRef = useRef(false);
  const [googleUser, setGoogleUser] = useState(null);
  const [googleToken, setGoogleToken] = useState(null);

  // propertiesRef for stable access inside callbacks
  const propertiesRef = useRef(properties);
  useEffect(() => { propertiesRef.current = properties; }, [properties]);

  // ─── 데이터 로드 ───
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const spreadsheetId = import.meta.env.VITE_SPREADSHEET_ID || '16urMn_RdMuw99MLpvASHG07h5EuKsCESc25-CcGH9Lo';
        const sheetGid = import.meta.env.VITE_SHEET_GID || '162008221';
        const csvUrl =
          GOOGLE_SHEET_CSV_URL ||
          `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${sheetGid}`;

        try {
          const tryRes = await fetch(csvUrl);
          if (tryRes.ok) {
            const { default: Papa } = await import('papaparse');
            const csvText = await tryRes.text();
            const { data, meta } = Papa.parse(csvText, {
              header: true,
              skipEmptyLines: true,
              transformHeader: (h) => (h ? String(h).replace(/\uFEFF/g, '').trim() : h),
            });
            const headers = meta.fields || Object.keys(data[0] || {});
            const normalized = data.map(normalizeRowObject);
            const mapped = normalized.map(mapRowToProperty);
            setProperties(mapped);
            setSheetMeta({ spreadsheetId, sheetTitle: null, headers });
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
            transformHeader: (h) => (h ? String(h).replace(/\uFEFF/g, '').trim() : h),
          });
          const headers = meta.fields || [];
          const normalized = data.map(normalizeRowObject);
          const mapped = normalized.map(mapRowToProperty);
          setProperties(mapped);
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
          setProperties(mapped);
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
      setProperties(mapped);
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
    try { if (googleToken) revokeToken(googleToken); } catch (e) { /* ignore */ }
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
      if (prev.length >= 5) {
        alert('최대 5개까지 선택할 수 있습니다.');
        return prev;
      }
      return [...prev, id];
    });
  }, []);

  const clearRouteSelection = useCallback(() => setRouteSelection([]), []);

  const routeResult = useMemo(() => {
    if (routeSelection.length < 2) return null;
    const selected = properties.filter((p) => routeSelection.includes(p.id));
    return optimizeRoute(selected);
  }, [routeSelection, properties]);

  // ─── 지오코딩 ───
  const geocodeMissing = useCallback(async (items) => {
    if (!items || items.length === 0) return;
    setGeocoding({ running: true, total: items.length, done: 0 });
    cancelGeocodeRef.current = false;
    let done = 0;
    for (const p of items) {
      if (cancelGeocodeRef.current) break;
      const addressParts = [p.address, p.buildingName, p.zone].filter(Boolean).join(', ');
      try {
        const geo = await geocodeAddress(addressParts);
        if (geo) {
          setProperties((prev) => prev.map((it) => (it.id === p.id ? { ...it, lat: geo.lat, lng: geo.lng } : it)));
        }
      } catch (e) { console.warn('geocode error', e); }
      done += 1;
      setGeocoding({ running: true, total: items.length, done });
      await new Promise((r) => setTimeout(r, 1100));
    }
    setGeocoding((s) => ({ ...s, running: false }));
  }, []);

  useEffect(() => {
    if (properties.length === 0) return;
    if (autoGeocodeDoneRef.current) return;
    const needs = properties.filter((p) => !(p && Number.isFinite(p.lat) && Number.isFinite(p.lng)));
    if (needs.length > 0) geocodeMissing(needs);
    autoGeocodeDoneRef.current = true;
    return () => { cancelGeocodeRef.current = true; };
  }, [properties, geocodeMissing]);

  // ─── 필터링 ───
  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      if (p.isCompleted && !filters.showCompleted) return false;
      const term = (filters.searchTerm || '').toLowerCase();
      const matchSearch =
        !term ||
        (p.statusOrName || '').toLowerCase().includes(term) ||
        (p.address || '').toLowerCase().includes(term) ||
        (p.zone || '').toLowerCase().includes(term) ||
        (p.buildingName || '').toLowerCase().includes(term) ||
        (p.notes || '').toLowerCase().includes(term);

      const matchZone = filters.zone === '전체' || p.zone === filters.zone;
      const matchVacant = !filters.isVacantOnly || p.isVacant;
      const matchType = filters.type === '전체' || p.type === filters.type;
      const matchDepositMin = !filters.depositMin || p.deposit >= Number(filters.depositMin);
      const matchDepositMax = !filters.depositMax || p.deposit <= Number(filters.depositMax);
      const matchRentMin = !filters.rentMin || p.rent >= Number(filters.rentMin);
      const matchRentMax = !filters.rentMax || p.rent <= Number(filters.rentMax);
      const matchPremiumMax = !filters.premiumMax || p.premium <= Number(filters.premiumMax);

      return (
        matchSearch && matchZone && matchVacant && matchType &&
        matchDepositMin && matchDepositMax && matchRentMin && matchRentMax && matchPremiumMax
      );
    });
  }, [properties, filters]);

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      searchTerm: '',
      zone: '전체',
      isVacantOnly: false,
      type: '전체',
      showCompleted: false,
      depositMin: null,
      depositMax: null,
      rentMin: null,
      rentMax: null,
      premiumMax: null,
    });
  }, []);

  const zones = useMemo(() => {
    const set = new Set(properties.map((p) => p.zone).filter(Boolean));
    return ['전체', ...Array.from(set).sort()];
  }, [properties]);

  return {
    properties,
    filteredProperties,
    loading,
    error,
    filters,
    zones,
    updateFilter,
    resetFilters,
    connectGoogle,
    disconnectGoogle,
    googleUser,
    googleToken,
    sheetMeta,
    geocoding,
    geocodeMissing,
    updateProperty,
    completeProperty,
    uncompleteProperty,
    routeSelection,
    toggleRouteSelection,
    clearRouteSelection,
    routeResult,
  };
}

