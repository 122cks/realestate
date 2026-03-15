'use strict';
/**
 * fetch-sheet.cjs
 * GitHub Actions에서 실행: 구글 스프레드시트 공개 CSV를 가져와
 * public/sheet-data.csv 로 저장합니다.
 * → 빌드 시 정적 파일로 포함되어 브라우저가 CORS 없이 즉시 로드 가능.
 */
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const { URL } = require('url');

const SPREADSHEET_ID = process.env.VITE_SPREADSHEET_ID || '16urMn_RdMuw99MLpvASHG07h5EuKsCESc25-CcGH9Lo';
const SHEET_GID      = process.env.VITE_SHEET_GID      || '162008221';

const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
const OUT_DIR  = path.join(__dirname, '..', 'public');
const OUT_FILE = path.join(OUT_DIR, 'sheet-data.csv');

function fetchUrl(urlStr, redirects) {
  if ((redirects || 0) > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(urlStr);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.get(urlStr, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SheetFetcher/1.0)',
          'Accept': 'text/csv,text/plain,*/*',
        },
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(fetchUrl(res.headers.location, (redirects || 0) + 1));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${urlStr}`));
          return;
        }
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        res.on('error', reject);
      });
      req.on('error', reject);
    } catch (e) { reject(e); }
  });
}

async function main() {
  console.log(`[fetch-sheet] Fetching Google Sheet CSV...`);
  console.log(`[fetch-sheet] URL: ${CSV_URL}`);
  try {
    const csv = await fetchUrl(CSV_URL);
    if (!csv || csv.trim().length < 10) {
      throw new Error('Response is empty or too small');
    }
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_FILE, csv, 'utf-8');
    const lines = csv.split('\n').length;
    console.log(`[fetch-sheet] ✅ Saved to ${OUT_FILE} (${lines} lines, ${csv.length} bytes)`);
  } catch (err) {
    console.error(`[fetch-sheet] ❌ Failed: ${err.message}`);
    // Graceful exit — continue-on-error in workflow handles this
    process.exit(0);
  }
}

main();
