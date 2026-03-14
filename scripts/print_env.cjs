const fs = require('fs');
const p = '.env.local';
if (!fs.existsSync(p)) { console.error('.env.local not found'); process.exit(2); }
const content = fs.readFileSync(p, 'utf8');
const lines = content.split(/\r?\n/);
for (const l of lines) {
  console.log(l);
  const m = l.match(/^\s*([^=]+)=(.*)$/);
  if (m) console.log('MATCH:', m[1], '=', m[2]);
}
