const fs = require('fs');
const child_process = require('child_process');
const path = require('path');

function safeExec(cmd) {
  try {
    return child_process.execSync(cmd, { encoding: 'utf8' }).trim();
  } catch (e) {
    return null;
  }
}

const pkgPath = path.resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const gitSha = safeExec('git rev-parse --short HEAD') || null;
const time = new Date().toISOString();
const out = {
  version: pkg.version || null,
  gitSha,
  time,
};

const outPath = path.resolve(__dirname, '..', 'public', 'build-info.json');
try {
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log('[build-info] wrote', outPath, out);
} catch (e) {
  console.error('[build-info] write failed', e && e.message);
  process.exitCode = 1;
}
