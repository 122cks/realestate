/**
 * geocode.js
 *
 * L1  in-memory Map   — 즉각 조회 (0ms), 앱 세션 유지
 * L2  IndexedDB       — 영구 로컬 저장소, 앱 시작 시 L1 전량 웜업
 * L3  Kakao SDK       — 실제 지오코딩 (한국 주소 최적)
 * L4  Nominatim       — Kakao SDK 없을 때만 사용
 *
 * 최초 방문: L3/L4 호출 → L1+L2 저장
 * 재방문  : L2 전량 L1 로드 → API 호출 0건, 즉시 반환
 */

// v4: DB 버전 업 — 모든 variant를 시도한 뒤 정확 매칭 우선 반환으로 변경
const DB_NAME = 'geocode_db_v4';
const STORE   = 'coords';

// ── L1: 인메모리 캐시 ──────────────────────────────────────────────────────
export const memCache = new Map();

// ── L2: IndexedDB ──────────────────────────────────────────────────────────
let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess  = () => { _db = req.result; resolve(_db); };
      req.onerror    = () => resolve(null);
      req.onblocked  = () => resolve(null);
    } catch { resolve(null); }
  });
}

function idbPut(key, value) {
  openDB().then(db => {
    if (!db) return;
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
    } catch { /* ignore */ }
  });
}

// ── 모듈 초기화: IndexedDB → L1 전량 웜업 ──────────────────────────────────
// 앱 마운트 전에 Promise가 시작되므로 첫 geocoding effect 실행 전 대부분 완료
export const cacheWarmPromise = openDB().then(db => {
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx  = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (cursor.value?.lat && cursor.value?.lng) memCache.set(cursor.key, cursor.value);
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => resolve();
    } catch { resolve(); }
  });
}).catch(() => {});

// ── 유틸 ──────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function withRetry(fn, attempts = 2, delay = 120) {
  for (let i = 0; i < attempts; i++) {
    try { const r = await fn(); if (r) return r; } catch { /* retry */ }
    if (i < attempts - 1) await sleep(delay * (i + 1));
  }
  return null;
}

async function kakaoGeocode(address) {
  if (!window.kakao?.maps?.services) return null;
  return new Promise((resolve) => {
    try {
      new window.kakao.maps.services.Geocoder().addressSearch(address, (results, status) => {
        if (status === window.kakao.maps.services.Status.OK && results?.length) {
          // 정확도 우선순위: REGION_ADDR(지번 정확) > ROAD_ADDR(도로명 정확) > 나머지
          const EXACT = ['REGION_ADDR', 'ROAD_ADDR'];
          const sorted = [...results].sort((a, b) => {
            const aScore = EXACT.includes(a.address_type) ? 0 : 1;
            const bScore = EXACT.includes(b.address_type) ? 0 : 1;
            return aScore - bScore;
          });
          const best = sorted[0];
          // REGION 타입은 동/구 레벨 매핑 — 부정확 표기
          const approxLocation = !EXACT.includes(best.address_type);
          resolve({
            lat: parseFloat(best.y),
            lng: parseFloat(best.x),
            approxLocation,
          });
        } else {
          resolve(null);
        }
      });
    } catch { resolve(null); }
  });
}

// ── 공개 API ───────────────────────────────────────────────────────────────
export async function geocodeAddress(address) {
  if (!address) return null;
  const key = address.trim();
  if (!key) return null;

  // L1: 인메모리 즉시 반환
  if (memCache.has(key)) return memCache.get(key);

  // 주소 변형 후보 (한국 지번 보정)
  // 부평구 소속 동 목록 — 구 정보가 없으면 자동 보완
  const BUPYEONG_DONGS_GEO = [
    '부평동', '삼산동', '갈산동', '산곡동', '청천동', '부개동',
    '일신동', '십정동', '작전동', '서운동', '효성동', '구산동',
  ];
  const BUCHEON_DONGS_GEO = [
    '상동', '중동', '원미동', '소사동', '약대동', '춘의동', '도당동',
    '옥길동', '계수동', '항동', '여월동', '고강동', '오정동', '내동',
    '삼정동', '작동', '범박동', '괴안동', '송내동', '심곡동', '역곡동',
  ];
  const GYEYANG_DONGS_GEO = [
    '계산동', '임학동', '용종동', '박촌동', '동양동', '병방동', '귤현동',
    '갈현동', '오류동', '이화동', '평동', '방축동', '장기동', '서운동',
  ];
  const SEO_DONGS_GEO = [
    '가좌동', '신현동', '검암동', '경서동', '청라동', '연희동',
    '공촌동', '원당동', '당하동', '마전동', '금곡동', '대곡동',
    '불로동', '시천동', '백석동', '오류동', '심곡동',
  ];
  const variants = [key];
  // 인천 주소인데 구 정보가 없으면 구 자동 보완
  if (/^인천\s+[^\s]+\s+\d/.test(key) && !key.includes('구')) {
    const dongMatch = key.match(/^인천\s+([^\s]+동)/);
    if (dongMatch) {
      const dong = dongMatch[1];
      let gu = null;
      if (BUPYEONG_DONGS_GEO.includes(dong)) gu = '부평구';
      else if (GYEYANG_DONGS_GEO.includes(dong)) gu = '계양구';
      else if (SEO_DONGS_GEO.includes(dong)) gu = '서구';
      if (gu) variants.push(key.replace(/^인천\s+/, `인천 ${gu} `));
    }
  }
  // 부천시 주소 보완: "부천시 상동 ..." 형태로도 시도
  if (/^부천시?\s+/.test(key)) {
    const normalized = key.replace(/^부천시?\s+/, '');
    variants.push(`경기도 부천시 ${normalized}`);
    variants.push(`부천시 ${normalized}`);
  }
  // 부천 동이 인천 주소로 잘못 빌드된 경우 교정
  if (/^인천\s+/.test(key)) {
    const dongMatch = key.match(/^인천\s+([^\s]+동)\s+(.+)/);
    if (dongMatch && BUCHEON_DONGS_GEO.includes(dongMatch[1])) {
      variants.push(`경기도 부천시 ${dongMatch[1]} ${dongMatch[2]}`);
      variants.push(`부천시 ${dongMatch[1]} ${dongMatch[2]}`);
    }
  }
  // 건물명이 있을 경우 추가 변형
  const parenMatch = key.match(/^([^(]+)\s*\(([^)]+)\)/);
  if (parenMatch) {
    variants.unshift(parenMatch[1].trim()); // 괄호 제거 버전을 최우선
  }

  // L3: Kakao SDK (in-browser, 한국 주소 최적)
  // 모든 variant를 시도해 정확한 매칭(address_type=REGION_ADDR/ROAD_ADDR)을 우선 반환
  // 정확한 결과가 없으면 근사 결과를 fallback으로 사용
  if (typeof window !== 'undefined' && window.kakao?.maps?.services) {
    let bestApprox = null;
    for (const q of variants) {
      const r = await withRetry(() => kakaoGeocode(q), 2, 120);
      if (r) {
        if (!r.approxLocation) {
          // 정확한 지번/도로명 매칭 — 즉시 저장 후 반환
          const out = { lat: r.lat, lng: r.lng, source: 'kakao', approxLocation: false };
          memCache.set(key, out);
          idbPut(key, out);
          return out;
        }
        if (!bestApprox) bestApprox = r; // 첫 근사 결과를 보조 후보로 보관
      }
    }
    // 모든 variant에서 정확한 매칭 없음 → 근사 결과 반환
    if (bestApprox) {
      const out = { lat: bestApprox.lat, lng: bestApprox.lng, source: 'kakao', approxLocation: true };
      memCache.set(key, out);
      idbPut(key, out);
      return out;
    }
    return null;
  }

  // L4: Nominatim fallback (Kakao SDK 없을 때만)
  try {
    for (const q of variants) {
      const r = await withRetry(async () => {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
          { headers: { 'Accept-Language': 'ko' } }
        );
        if (!res.ok) return null;
        const data = await res.json();
        if (!data?.length) return null;
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }, 2, 600);
      if (r) {
        const out = { ...r, source: 'nominatim' };
        memCache.set(key, out);
        idbPut(key, out);
        return out;
      }
    }
  } catch { /* ignore */ }
  return null;
}

export function clearGeocodeCache() {
  memCache.clear();
  _db = null;
  try {
    if (typeof window !== 'undefined') window.indexedDB?.deleteDatabase(DB_NAME);
  } catch { /* ignore */ }
}
