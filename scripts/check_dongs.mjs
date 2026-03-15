import { mockProperties } from '../src/data/mockProperties.js';

const BUCHEON_DONGS = new Set([
  '상동','중동','원미동','소사동','약대동','춘의동','도당동','옥길동','계수동','항동','여월동','고강동','오정동','내동','삼정동','작동','범박동','괴안동','송내동','심곡동','역곡동','소사본동','중1동','중2동','중3동','중4동','중5동'
]);
const BUPYEONG_DONGS = new Set([
  '부평동','삼산동','갈산동','산곡동','청천동','부개동','일신동','십정동','작전동','서운동','효성동','구산동'
]);
const GYEYANG_DONGS = new Set([
  '계산동','임학동','용종동','박촌동','동양동','병방동','귤현동','갈현동','오류동','이화동','평동','방축동','장기동','서운동'
]);
const SEO_DONGS = new Set([
  '가좌동','신현동','검암동','경서동','청라동','연희동','공촌동','원당동','당하동','마전동','금곡동','대곡동','불로동','시천동','백석동','오류동','심곡동'
]);

function getDongRegion(dong) {
  if (!dong) return null;
  if (BUCHEON_DONGS.has(dong)) return '부천시';
  if (BUPYEONG_DONGS.has(dong)) return '부평구';
  if (GYEYANG_DONGS.has(dong)) return '계양구';
  if (SEO_DONGS.has(dong)) return '서구';
  return '인천시';
}

const checkList = ['가정동','가좌동','간석동','갈산동','검암동','계산동','구산동','도화동','박촌동','부개동','부평동','산곡동','삼산동','상동'];

console.log('동 → 추정 지역');
for (const d of checkList) {
  console.log(d.padEnd(8), '→', getDongRegion(d));
}

console.log('\nMock properties mapping (id, dong → region):');
for (const p of mockProperties) {
  const dong = (p.dong || '').trim();
  console.log(`#${p.id}`, dong.padEnd(8), '→', getDongRegion(dong));
}

console.log('\n검사 완료');
