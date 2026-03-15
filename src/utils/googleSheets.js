// Google Sheets + OAuth helper (browser)
// Uses Google Identity Services token client to request an access token
// and then calls the Sheets REST API. Requires Vite env: VITE_GOOGLE_CLIENT_ID

const DEFAULT_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/userinfo.email';

function ensureGoogleLoaded() {
  if (typeof window === 'undefined' || !window.google || !window.google.accounts || !window.google.accounts.oauth2) {
    throw new Error('Google Identity Services not loaded (index.html에 <script src="https://accounts.google.com/gsi/client"> 필요)');
  }
}

export function requestAccessToken(clientId, prompt = 'consent') {
  return new Promise((resolve, reject) => {
    try {
      ensureGoogleLoaded();
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DEFAULT_SCOPE,
        callback: (resp) => {
          if (resp.error) return reject(resp);
          resolve(resp.access_token || resp);
        },
      });
      // must be called in a user gesture (click)
      tokenClient.requestAccessToken({ prompt });
    } catch (err) {
      reject(err);
    }
  });
}

async function fetchJson(url, accessToken) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Google API error ${res.status}: ${txt}`);
  }
  return res.json();
}

export async function getSheetTitleByGid(spreadsheetId, gid, accessToken) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`;
  const json = await fetchJson(url, accessToken);
  const sheets = (json.sheets || []).map((s) => s.properties);
  if (!sheets.length) throw new Error('시트 정보가 없습니다.');
  const target = sheets.find((s) => String(s.sheetId) === String(gid));
  return (target && target.title) || sheets[0].title;
}

export async function fetchSheetValuesAsObjects(spreadsheetId, sheetTitle, accessToken) {
  const range = encodeURIComponent(sheetTitle);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`;
  const json = await fetchJson(url, accessToken);
  const values = json.values || [];
  if (!values.length) return [];
  const headers = values[0];
  const rows = values.slice(1).map((row) => {
    const obj = {};
    for (let i = 0; i < headers.length; i += 1) {
      const key = headers[i] || `col_${i}`;
      obj[key] = row[i] !== undefined ? row[i] : '';
    }
    return obj;
  });
  return rows;
}

export async function fetchUserInfo(accessToken) {
  // Returns {email, name, picture}
  try {
    const url = 'https://www.googleapis.com/oauth2/v3/userinfo';
    return await fetchJson(url, accessToken);
  } catch {
    return null;
  }
}

// --- API key based access (for PUBLIC sheets) ---
async function fetchJsonWithKey(url, apiKey) {
  const sep = url.includes('?') ? '&' : '?';
  const res = await fetch(`${url}${sep}key=${encodeURIComponent(apiKey)}`);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Google API key error ${res.status}: ${txt}`);
  }
  return res.json();
}

export async function getSheetTitleByGidWithApiKey(spreadsheetId, gid, apiKey) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`;
  const json = await fetchJsonWithKey(url, apiKey);
  const sheets = (json.sheets || []).map((s) => s.properties);
  if (!sheets.length) throw new Error('시트 정보가 없습니다. (API Key로는 PUBLIC 시트만 접근 가능합니다)');
  const target = sheets.find((s) => String(s.sheetId) === String(gid));
  return (target && target.title) || sheets[0].title;
}

export async function fetchSheetValuesAsObjectsWithApiKey(spreadsheetId, sheetTitle, apiKey) {
  const range = encodeURIComponent(sheetTitle);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`;
  const json = await fetchJsonWithKey(url, apiKey);
  const values = json.values || [];
  if (!values.length) return [];
  const headers = values[0];
  const rows = values.slice(1).map((row) => {
    const obj = {};
    for (let i = 0; i < headers.length; i += 1) {
      const key = headers[i] || `col_${i}`;
      obj[key] = row[i] !== undefined ? row[i] : '';
    }
    return obj;
  });
  return rows;
}

export async function fetchWithApiKey(spreadsheetId, sheetGid, apiKey) {
  if (!apiKey) throw new Error('VITE_GOOGLE_API_KEY가 설정되어 있지 않습니다. .env에 VITE_GOOGLE_API_KEY를 추가하세요.');
  const title = await getSheetTitleByGidWithApiKey(spreadsheetId, sheetGid, apiKey);
  const rows = await fetchSheetValuesAsObjectsWithApiKey(spreadsheetId, title, apiKey);
  return { rows, title };
}

export async function authorizeAndFetch(spreadsheetId, sheetGid, clientId) {
  if (!clientId) throw new Error('VITE_GOOGLE_CLIENT_ID가 설정되어 있지 않습니다. .env에 VITE_GOOGLE_CLIENT_ID를 추가하세요.');
  ensureGoogleLoaded();
  const token = await requestAccessToken(clientId);
  const title = await getSheetTitleByGid(spreadsheetId, sheetGid, token);
  const rows = await fetchSheetValuesAsObjects(spreadsheetId, title, token);
  const user = await fetchUserInfo(token);
  return { rows, user, token, title };
}

export function revokeToken(token) {
  try {
    if (typeof window !== 'undefined' && window.google && window.google.accounts && window.google.accounts.oauth2) {
      window.google.accounts.oauth2.revoke(token, () => {});
    }
  } catch {
    // ignore
  }
}

// ─────────────────────────────────────────────
// Google Sheets 쓰기 지원 (OAuth 토큰 필요)
// ─────────────────────────────────────────────

/**
 * 시트의 특정 행을 새 값으로 덮어씁니다.
 * @param {string} spreadsheetId
 * @param {string} sheetTitle - 시트 이름 (탭 이름)
 * @param {number} rowNum - 1-based 행 번호 (2 = 첫 번째 데이터 행)
 * @param {string[]} values - 열 순서대로 정렬된 값 배열
 * @param {string} accessToken
 */
export async function updateSheetRowValues(spreadsheetId, sheetTitle, rowNum, values, accessToken) {
  const rangeNotation = `'${sheetTitle}'!A${rowNum}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(rangeNotation)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      range: rangeNotation,
      majorDimension: 'ROWS',
      values: [values],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Sheets PUT 오류 ${res.status}: ${txt}`);
  }
  return res.json();
}

/**
 * 헤더 배열과 프로퍼티 객체를 받아 시트 행 값 배열을 구성합니다.
 * 헤더 이름 → 내부 프로퍼티 키 매핑 기반.
 */
const PROP_TO_SHEET_HEADERS = {
  rawState: ['상태'],
  receivedDate: ['접수일'],
  zone: ['구역'],
  statusOrName: ['상호명/상태', '상호명', '상호 / 상태', '상태'],
  address: ['주소', '도로명주소', '지번주소'],
  buildingName: ['건물명'],
  floor: ['층수', '층'],
  areaExclusive: ['전용면적', '면적'],
  deposit: ['보증금'],
  rent: ['월세'],
  premium: ['권리금'],
  maintenanceFee: ['관리비'],
  lat: ['위도'],
  lng: ['경도'],
  type: ['유형'],
  isVacant: ['공실여부'],
  notes: ['비고'],
  contactTenant: ['임차인연락처'],
  contactOwner: ['임대인연락처'],
};

export function buildSheetRow(headers, prop) {
  return (headers || []).map((h) => {
    const cleanH = String(h || '').replace(/\uFEFF/g, '').trim();
    // 중복 헤더 정규화 (예: 주소_1 → 주소)
    const baseH = cleanH.replace(/(_\d+$|\(\d+\)$)/, '').trim();
    for (const [propKey, possibles] of Object.entries(PROP_TO_SHEET_HEADERS)) {
      if (possibles.some((ph) => ph === baseH || ph === cleanH)) {
        const val = prop[propKey];
        if (val === null || val === undefined) return '';
        if (propKey === 'isVacant') return val ? '공실' : '';
        return String(val);
      }
    }
    return '';
  });
}

/**
 * fetchSheetValuesAsObjects 기존 함수에 헤더 반환 추가
 * 기존 fetchWithApiKey/authorizeAndFetch 래퍼에서도 headers를 반환
 */
export async function fetchSheetValuesAsObjectsFull(spreadsheetId, sheetTitle, accessToken) {
  const range = encodeURIComponent(sheetTitle);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`;
  const json = await fetchJson(url, accessToken);
  const values = json.values || [];
  if (!values.length) return { rows: [], headers: [] };
  const headers = values[0];
  const rows = values.slice(1).map((row) => {
    const obj = {};
    for (let i = 0; i < headers.length; i += 1) {
      const key = headers[i] || `col_${i}`;
      obj[key] = row[i] !== undefined ? row[i] : '';
    }
    return obj;
  });
  return { rows, headers };
}
