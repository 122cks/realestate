import fs from 'fs/promises';
const p = '.env.local';
try {
  const content = await fs.readFile(p, 'utf8');
  const lines = content.split(/\r?\n/);
  const env = {};
  for (const l of lines) {
    const m = l.match(/^\s*([^=]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  const key = env.VITE_KAKAO_JS_KEY;
  if (!key) {
    console.error('VITE_KAKAO_JS_KEY is empty');
    process.exit(2);
  }
  const url = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services`;
  const res = await fetch(url, { method: 'GET', headers: { 'User-Agent': 'node-fetch/1.0' } });
  console.log('status', res.status);
  const text = await res.text();
  console.log(text.slice(0, 800));
} catch (e) {
  console.error('error', e.message || e);
  process.exit(3);
}
