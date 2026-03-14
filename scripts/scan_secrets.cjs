const fs = require('fs');
const path = require('path');

const IGNORES = ['.git', 'node_modules', 'dist', 'build', '.github'];
const root = process.cwd();

const patterns = [
  { name: 'Google API key (AIza...)', re: /AIza[0-9A-Za-z-_]{35,}/g },
  { name: 'Kakao REST key (KakaoAK ...)', re: /KakaoAK\s*[:=]?\s*([A-Za-z0-9-_]+)/gi },
  { name: 'appkey query param', re: /appkey=([A-Za-z0-9-_]+)/gi },
  { name: 'VITE env var', re: /VITE_[A-Z0-9_]+/g },
  { name: 'Possible secret (long base64)', re: /[A-Za-z0-9_\-]{40,}/g }
];

function walk(dir) {
  const res = [];
  for (const name of fs.readdirSync(dir)) {
    if (IGNORES.includes(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      res.push(...walk(full));
    } else if (stat.isFile()) {
      res.push(full);
    }
  }
  return res;
}

function scan() {
  const files = walk(root);
  const results = [];
  for (const f of files) {
    try {
      const ext = path.extname(f).toLowerCase();
      // only scan text files
      if (['.png', '.jpg', '.jpeg', '.zip', '.tgz', '.ico', '.exe'].includes(ext)) continue;
      const txt = fs.readFileSync(f, 'utf8');
      for (const p of patterns) {
        let m;
        while ((m = p.re.exec(txt)) !== null) {
          results.push({ file: f, pattern: p.name, match: m[0].slice(0, 200) });
        }
      }
    } catch (e) {
      // skip binary or unreadable files
    }
  }
  if (results.length === 0) {
    console.log('No likely secrets found (quick scan).');
    return;
  }
  console.log('Possible secrets found:\n');
  for (const r of results) {
    console.log(`- ${r.pattern}: ${r.file}`);
    console.log(`  > ${r.match}\n`);
  }
}

scan();
