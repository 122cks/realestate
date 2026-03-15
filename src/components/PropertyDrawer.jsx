import React, { useState, useEffect, useCallback } from 'react';
import {
  X, MapPin, Building2, Phone, User,
  Layers, SquareStack, Wrench,
  Calendar, Tag, ExternalLink, Pencil, CheckCircle2, RotateCcw,
  Navigation, Share2, Copy, Calculator, Printer, PenLine,
  ChevronDown, ChevronUp, BarChart3, Sparkles, Loader2, Store
} from 'lucide-react';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const fmt = (n) => {
  if (!n && n !== 0) return '-';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}억 원`;
  return `${n.toLocaleString()}만 원`;
};

const TYPE_STYLE = {
  임대: 'bg-blue-100 text-blue-800 border-blue-200',
  매매: 'bg-rose-100 text-rose-800 border-rose-200',
};

function InfoRow({ icon: Icon, label, value, highlight, className = '' }) { // eslint-disable-line no-unused-vars
  if (!value && value !== 0) return null;
  return (
    <div className={`flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0 ${className}`}>
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={16} className="text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className={`text-sm font-semibold mt-0.5 break-words ${highlight || 'text-slate-800'}`}>{value}</p>
      </div>
    </div>
  );
}

function PriceCard({ label, value, highlight, sub }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
      <p className="text-xs text-slate-400 font-medium mb-1">{label}</p>
      <p className={`font-extrabold text-lg leading-tight ${highlight}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function fmtShare(n) {
  if (!n && n !== 0) return '-';
  if (n >= 10000) return `${(n/10000).toFixed(1)}억`;
  return `${n.toLocaleString()}만`;
}

export default function PropertyDrawer({ property, onClose, onEdit, onComplete, onUncomplete }) {
  const [showCalc, setShowCalc] = useState(false);
  const [memo, setMemo] = useState('');
  const [aiResult, setAiResult] = useState(null);   // null | string
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [showAi, setShowAi] = useState(false);
  const [nearbyData, setNearbyData] = useState(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState(null);
  const [showNearby, setShowNearby] = useState(false);

  // 매물 변경 시 상태 초기화 + 캐시 로드
  useEffect(() => {
    setAiError(null); setAiLoading(false);
    setNearbyData(null); setNearbyError(null); setShowNearby(false);
    // 캐시된 Gemini 결과 로드
    try {
      const cached = localStorage.getItem(`re_gemini_${property.id}`);
      if (cached) {
        setAiResult(cached);
        setShowAi(true);
      } else {
        setAiResult(null);
        setShowAi(false);
      }
    } catch { setAiResult(null); setShowAi(false); }
  }, [property.id]);

  useEffect(() => {
    try { setMemo(localStorage.getItem(`re_memo_${property.id}`) || ''); } catch { setMemo(''); }
  }, [property.id]);

  const handleMemoChange = useCallback((e) => {
    const val = e.target.value;
    setMemo(val);
    try {
      if (val) localStorage.setItem(`re_memo_${property.id}`, val);
      else localStorage.removeItem(`re_memo_${property.id}`);
    } catch { /* ignore */ }
  }, [property.id]);

  // 투자 계산값
  const pyeong = property.areaExclusive > 0 ? +(property.areaExclusive / 3.3058).toFixed(1) : null;
  const totalInvestment = (property.deposit || 0) + (property.premium || 0);
  const annualRent = (property.rent || 0) * 12;
  const roi = totalInvestment > 0 && annualRent > 0
    ? (annualRent / totalInvestment * 100).toFixed(2)
    : null;
  const depositPerPyeong = pyeong > 0 && (property.deposit || 0) > 0
    ? Math.round(property.deposit / pyeong)
    : null;
  const brokerBase = (property.deposit || 0) + (property.rent || 0) * 100;
  const brokerFee = brokerBase > 0 ? Math.round(brokerBase * 0.009) : 0;

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleShare = useCallback(() => {
    const lines = [
      `📍 [${property.type}] ${property.statusOrName || '공실'}`,
      `🏢 ${property.address}${property.buildingName ? ` (${property.buildingName})` : ''}`,
      `💰 보증금 ${fmtShare(property.deposit)} / 월세 ${fmtShare(property.rent)}${property.premium > 0 ? ` / 권리금 ${fmtShare(property.premium)}` : ''}`,
      property.areaExclusive > 0 ? `📐 전용 ${property.areaExclusive}㎡ · ${property.floor || '-'}층` : null,
      property.zone ? `📌 구역: ${property.zone}` : null,
      property.notes ? `📋 ${property.notes.slice(0, 80)}${property.notes.length > 80 ? '…' : ''}` : null,
      property.contactOwner ? `📞 임대인: ${property.contactOwner}` : null,
    ].filter(Boolean).join('\n');
    if (navigator.share) {
      navigator.share({ title: property.statusOrName || '매물 정보', text: lines }).catch(() => {});
    } else {
      navigator.clipboard.writeText(lines).then(() => alert('매물 정보가 클립보드에 복사되었습니다.'));
    }
  }, [property]);

  const handleCopyBlog = useCallback(() => {
    const pStr = pyeong ? `전용 ${property.areaExclusive}㎡ (약 ${pyeong}평)` : null;
    const txt = [
      `[${property.type} 매물 소개] ${property.statusOrName || '공실 매물'}`,
      '',
      `📍 위치: ${property.address}${property.buildingName ? ` (${property.buildingName})` : ''}`,
      property.zone ? `🗺️ 구역: ${property.zone}` : null,
      '',
      `💰 보증금: ${fmt(property.deposit)}`,
      `💸 월 세: ${fmt(property.rent)}`,
      property.premium > 0 ? `🔑 권리금: ${fmt(property.premium)}` : null,
      property.maintenanceFee > 0 ? `🔧 관리비: ${property.maintenanceFee.toLocaleString()}만 원/월` : null,
      '',
      pStr ? `📐 면 적: ${pStr}` : null,
      property.floor ? `🏢 층 수: ${property.floor}층 (총 ${property.totalFloors || '-'}층)` : null,
      '',
      property.hasRestaurant ? `✅ 식당 영업 가능` : null,
      property.parking ? `✅ 주차 가능` : null,
      property.hasElevator ? `✅ 엘리베이터 있음` : null,
      '',
      property.notes ? `📋 ${property.notes}` : null,
      '',
      `#상가임대 #${property.zone || '상가'} #부동산 #${property.type} #임대매물`,
    ].filter(v => v !== null).join('\n');
    navigator.clipboard.writeText(txt).then(() => alert('블로그 문구가 복사되었습니다! 📋'));
  }, [property, pyeong]);

  const handleCopyInstagram = useCallback(() => {
    const pStr = pyeong ? `전용 ${pyeong}평` : null;
    const tags = ['#상가임대', '#부동산', `#${property.zone || '상가매물'}`, '#임대문의', '#상가매물'].join(' ');
    const txt = [
      `📍 ${property.zone ? `[${property.zone}] ` : ''}${property.type} 매물이 나왔어요!`,
      '',
      `💰 보증금 ${fmtShare(property.deposit)} / 월세 ${fmtShare(property.rent)}${property.premium > 0 ? ` / 권리금 ${fmtShare(property.premium)}` : ''}`,
      pStr ? `📐 ${pStr}` : null,
      property.floor ? `🏢 ${property.floor}층` : null,
      property.hasRestaurant ? `🍳 식당 가능` : null,
      property.parking ? `🚗 주차 가능` : null,
      '',
      `📞 문의 주세요 😊`,
      '',
      tags,
    ].filter(v => v !== null).join('\n');
    navigator.clipboard.writeText(txt).then(() => alert('인스타그램 문구가 복사되었습니다! 📋'));
  }, [property, pyeong]);

  const handlePrint = useCallback(() => {
    const pStr = pyeong ? `전용 ${property.areaExclusive}㎡ (약 ${pyeong}평)` : null;
    const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<title>${property.statusOrName || '매물'} 브리핑</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;padding:24px;color:#1e293b;font-size:13px}
.hdr{background:linear-gradient(135deg,#1e293b,#334155);color:#fff;padding:18px;border-radius:10px;margin-bottom:14px}
.hdr h1{font-size:20px;font-weight:800;margin:6px 0 3px}
.hdr p{font-size:12px;opacity:.7}
.badge{display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;margin-right:5px}
.sec{border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:10px}
.sec-t{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.pg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
.pc{background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:9px;text-align:center}
.pl{font-size:10px;color:#94a3b8;margin-bottom:2px}
.pv{font-size:16px;font-weight:800}
.ir{display:flex;padding:4px 0;border-bottom:1px solid #f1f5f9}
.il{width:85px;font-size:11px;color:#94a3b8;font-weight:600;flex-shrink:0}
.iv{font-size:11px;color:#1e293b;font-weight:600}
.roi{display:flex;align-items:center;justify-content:space-between;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:7px;padding:9px 13px;margin-top:8px}
.nb{background:#fffbeb;border:1px solid #fde68a;border-radius:7px;padding:10px;font-size:12px;line-height:1.6;white-space:pre-line;margin-top:6px}
.foot{margin-top:18px;font-size:10px;color:#94a3b8;text-align:right;border-top:1px solid #e2e8f0;padding-top:8px}
@media print{body{padding:10px}}
${'</'}style>${'</'}head><body>
<div class="hdr">
  <div><span class="badge" style="background:#dbeafe;color:#1d4ed8">${property.type}</span>${property.zone ? `<span class="badge" style="background:rgba(255,255,255,.2);color:#fff">${property.zone}</span>` : ''}${property.isVacant ? `<span class="badge" style="background:#dcfce7;color:#15803d">공실</span>` : ''}</div>
  <h1>${property.statusOrName || '공실 매물'}</h1>
  <p>${property.address}${property.buildingName ? ` (${property.buildingName})` : ''}</p>
</div>
<div class="sec">
  <div class="sec-t">💰 가격 정보</div>
  <div class="pg">
    <div class="pc"><div class="pl">보증금</div><div class="pv">${fmt(property.deposit)}</div></div>
    <div class="pc"><div class="pl">월 세</div><div class="pv" style="color:#e11d48">${fmt(property.rent)}</div></div>
    <div class="pc"><div class="pl">권리금</div><div class="pv" style="color:${property.premium > 0 ? '#d97706' : '#94a3b8'}">${property.premium > 0 ? fmt(property.premium) : '없음'}</div></div>
  </div>
  ${property.maintenanceFee > 0 ? `<div style="text-align:right;font-size:11px;color:#64748b;margin-bottom:6px">관리비: ${property.maintenanceFee.toLocaleString()}만 원/월</div>` : ''}
  ${roi ? `<div class="roi"><div><div style="font-size:12px;color:#15803d;font-weight:700">예상 수익률 (ROI)</div><div style="font-size:10px;color:#86efac">월세×12 ÷ (보증금+권리금)</div></div><div style="font-size:22px;font-weight:900;color:#16a34a">${roi}%</div></div>` : ''}
  ${depositPerPyeong ? `<div style="display:flex;justify-content:space-between;align-items:center;background:#eff6ff;border:1px solid #bfdbfe;border-radius:7px;padding:8px 12px;margin-top:8px"><span style="font-size:12px;color:#1d4ed8;font-weight:700">보증금 평단가</span><span style="font-size:16px;font-weight:900;color:#1e40af">${depositPerPyeong.toLocaleString()}만/평</span></div>` : ''}
</div>
<div class="sec">
  <div class="sec-t">🏢 물건 정보</div>
  ${property.floor ? `<div class="ir"><div class="il">층/호수</div><div class="iv">${[property.floor ? property.floor + '층' : null, property.unit ? property.unit + '호' : null, property.totalFloors ? '(총 ' + property.totalFloors + '층)' : null].filter(Boolean).join(' ')}</div></div>` : ''}
  ${pStr ? `<div class="ir"><div class="il">면적</div><div class="iv">${pStr}</div></div>` : ''}
  ${property.hasRestaurant || property.parking || property.hasElevator ? `<div class="ir"><div class="il">특징</div><div class="iv">${[property.hasRestaurant ? '식당가능' : null, property.parking ? '주차가능' : null, property.hasElevator ? '엘리베이터' : null].filter(Boolean).join(' · ')}</div></div>` : ''}
  ${property.receivedDate ? `<div class="ir"><div class="il">접수일</div><div class="iv">${property.receivedDate}</div></div>` : ''}
</div>
${(property.contactOwner || property.contactTenant) ? `<div class="sec"><div class="sec-t">📞 연락처</div>${property.contactOwner ? `<div class="ir"><div class="il">임대인</div><div class="iv">${[property.ownerName, property.contactOwner].filter(Boolean).join(' / ')}</div></div>` : ''}${property.contactTenant ? `<div class="ir"><div class="il">임차인</div><div class="iv">${property.contactTenant}</div></div>` : ''}${property.manager ? `<div class="ir"><div class="il">담당자</div><div class="iv">${property.manager}${property.confirmedDate ? ` (확인: ${property.confirmedDate})` : ''}</div></div>` : ''}</div>` : ''}
${property.notes ? `<div class="sec"><div class="sec-t">📋 비고</div><div class="nb">${property.notes}</div></div>` : ''}
${memo ? `<div class="sec"><div class="sec-t">🗒 현장 메모</div><div class="nb">${memo}</div></div>` : ''}
<div class="foot">출력일: ${new Date().toLocaleDateString('ko-KR')} · 내부 자료 / 외부 유출 금지</div>
${'</'}body>${'</'}html>`;
    const w = window.open('', '_blank', 'width=820,height=920');
    if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 600); }
  }, [property, pyeong, roi, depositPerPyeong, memo]);

  const handleGeminiAnalyze = useCallback(async () => {
    if (!GEMINI_API_KEY) {
      setAiError('VITE_GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
      setShowAi(true);
      return;
    }
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    setShowAi(true);

    const pStr = pyeong ? `전용 ${property.areaExclusive}㎡ (약 ${pyeong}평)` : '면적 미입력';
    const prompt = [
      `당신은 부동산 전문 컨설턴트입니다. 아래 상가 매물 데이터를 분석하고, 실전 투자자 관점에서 핵심만 간결하게 한국어로 작성하세요.`,
      ``,
      `## 매물 정보`,
      `- 유형: ${property.type}`,
      `- 구역: ${property.zone || '미입력'}`,
      `- 상호/상태: ${property.statusOrName || '-'}`,
      `- 주소: ${property.address}${property.buildingName ? ` (${property.buildingName})` : ''}`,
      `- 층/면적: ${property.floor ? property.floor + '층' : '-'} / ${pStr}`,
      `- 보증금: ${property.deposit ? property.deposit.toLocaleString() + '만 원' : '-'}`,
      `- 월세: ${property.rent ? property.rent.toLocaleString() + '만 원' : '-'}`,
      `- 권리금: ${property.premium > 0 ? property.premium.toLocaleString() + '만 원' : '없음'}`,
      `- 관리비: ${property.maintenanceFee > 0 ? property.maintenanceFee + '만 원/월' : '없음'}`,
      roi ? `- 예상 ROI: ${roi}%` : '',
      depositPerPyeong ? `- 보증금 평단가: ${depositPerPyeong.toLocaleString()}만/평` : '',
      `- 식당가능: ${property.hasRestaurant ? '예' : '아니오'}`,
      `- 주차: ${property.parking ? '가능' : '불가'}`,
      `- 엘리베이터: ${property.hasElevator ? '있음' : '없음'}`,
      property.notes ? `- 비고: ${property.notes}` : '',
      ``,
      `## 분석 항목 (각 항목 2~4줄, 불릿 사용)`,
      `1. **투자 가치 평가** — ROI·권리금·월세 부담을 종합한 투자 매력도`,
      `2. **강점과 리스크** — 위치·시설·조건상 주요 장점과 주의할 점`,
      `3. **협상 포인트** — 임대료·권리금 조정 가능성 및 전략`,
      `4. **한 줄 결론** — 이 매물을 일반 투자자에게 추천할지 여부와 이유`,
    ].filter(Boolean).join('\n');

    try {
      // 사용 가능한 최신 Gemini 모델로 변경 (gemini-2.5)
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
          }),
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('응답 텍스트를 파싱할 수 없습니다.');
      setAiResult(text);
      // 결과 캐시 저장 (property.id 기반)
      try { localStorage.setItem(`re_gemini_${property.id}`, text); } catch { /* ignore */ }
    } catch (e) {
      setAiError(`분석 실패: ${e.message}`);
    } finally {
      setAiLoading(false);
    }
  }, [property, pyeong, roi, depositPerPyeong]);

  const handleNearbyAnalysis = useCallback(async () => {
    if (!window.kakao?.maps?.services) {
      setNearbyError('카카오맵 SDK가 아직 로드되지 않았습니다.'); setShowNearby(true); return;
    }
    if (!Number.isFinite(property.lat) || !Number.isFinite(property.lng)) {
      setNearbyError('이 매물의 좌표 정보가 없습니다.'); setShowNearby(true); return;
    }
    setNearbyLoading(true); setNearbyError(null); setNearbyData(null); setShowNearby(true);
    const CATS = [
      { code: 'SW8', label: '지하철역', emoji: '🚇' },
      { code: 'CE7', label: '카페', emoji: '☕' },
      { code: 'FD6', label: '음식점', emoji: '🍽️' },
      { code: 'CS2', label: '편의점', emoji: '🏪' },
      { code: 'BK9', label: '은행', emoji: '🏦' },
      { code: 'HP8', label: '병원/의원', emoji: '🏥' },
    ];
    const ps = new window.kakao.maps.services.Places();
    const location = new window.kakao.maps.LatLng(property.lat, property.lng);
    try {
      const results = await Promise.all(
        CATS.map(cat => new Promise(resolve => {
          ps.categorySearch(cat.code, (data, status) => {
            const items = (status === window.kakao.maps.services.Status.OK ? data : []);
            resolve({ ...cat, count: items.length, top: items.slice(0, 3).map(d => d.place_name) });
          }, { location, radius: 500 });
        }))
      );
      setNearbyData(results);
    } catch {
      setNearbyError('주변 정보 조회 중 오류가 발생했습니다.');
    } finally {
      setNearbyLoading(false);
    }
  }, [property.lat, property.lng]);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col overflow-hidden animate-slide-in">
        {/* 헤더 */}
        <div className="flex items-start justify-between p-5 border-b border-slate-200 bg-gradient-to-r from-slate-800 to-slate-700 text-white">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${TYPE_STYLE[property.type] || TYPE_STYLE['임대']}`}>
                {property.type}
              </span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{property.zone}</span>
              {property.isVacant && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-400/20 text-green-300 border border-green-400/30 animate-pulse">
                  ● 공실
                </span>
              )}
              {property.isCompleted && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-500/50 text-slate-200 border border-slate-400/30">
                  ✓ 완료
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold leading-tight">{property.statusOrName}</h2>
            <p className="text-sm text-white/70 mt-1 flex items-center gap-1">
              <MapPin size={13} />
              {property.address}
              {property.buildingName && ` (${property.buildingName})`}
            </p>
            {property.receivedDate && (
              <p className="text-xs text-white/50 mt-1 flex items-center gap-1">
                <Calendar size={11} /> 접수: {property.receivedDate}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto">
          {/* 가격 카드 */}
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">💰 가격 정보</h3>
            <div className="grid grid-cols-3 gap-2.5">
              <PriceCard label="보증금" value={fmt(property.deposit)} highlight="text-slate-800" />
              <PriceCard label="월세" value={fmt(property.rent)} highlight="text-rose-600" />
              <PriceCard
                label="권리금"
                value={property.premium > 0 ? fmt(property.premium) : '없음'}
                highlight={property.premium > 0 ? 'text-amber-600' : 'text-slate-400'}
              />
            </div>
            {property.maintenanceFee > 0 && (
              <div className="mt-2 flex items-center justify-end gap-1.5 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-1.5">
                <Wrench size={12} />
                관리비 월 <span className="font-semibold text-slate-700">{property.maintenanceFee.toLocaleString()}만 원</span>
              </div>
            )}
          </div>

          {/* 투자 계산기 */}
          <div className="p-4 border-b border-slate-100">
            <button
              onClick={() => setShowCalc(v => !v)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition"
            >
              <span className="flex items-center gap-1.5"><Calculator size={13} /> 투자 계산기</span>
              {showCalc ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showCalc && (
              <div className="mt-3 space-y-2">
                {roi !== null && (
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-200">
                    <div>
                      <p className="text-xs text-green-600 font-semibold">수익률 (ROI)</p>
                      <p className="text-xs text-green-400 mt-0.5">월세×12 ÷ (보증금+권리금)</p>
                    </div>
                    <span className="text-2xl font-extrabold text-green-600">{roi}%</span>
                  </div>
                )}
                {depositPerPyeong !== null && (
                  <div className="flex items-center justify-between p-3 bg-sky-50 rounded-xl border border-sky-200">
                    <div>
                      <p className="text-xs text-sky-600 font-semibold">보증금 평단가</p>
                      <p className="text-xs text-sky-400 mt-0.5">전용 {pyeong}평 기준</p>
                    </div>
                    <span className="text-lg font-extrabold text-sky-700">{depositPerPyeong.toLocaleString()}만/평</span>
                  </div>
                )}
                {brokerFee > 0 && (
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <div>
                      <p className="text-xs text-amber-600 font-semibold">예상 중개수수료</p>
                      <p className="text-xs text-amber-400 mt-0.5">상업용 0.9% 기준</p>
                    </div>
                    <span className="text-lg font-extrabold text-amber-700">{brokerFee.toLocaleString()}만 원</span>
                  </div>
                )}
                {totalInvestment > 0 && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <p className="text-xs text-slate-500 font-semibold">총 투자 예상액</p>
                      <p className="text-xs text-slate-400 mt-0.5">보증금 + 권리금</p>
                    </div>
                    <span className="text-lg font-extrabold text-slate-700">{fmt(totalInvestment)}</span>
                  </div>
                )}
                {!roi && !depositPerPyeong && !brokerFee && (
                  <p className="text-xs text-slate-400 text-center py-2">가격/면적 정보를 입력하면 자동으로 계산됩니다.</p>
                )}
              </div>
            )}
          </div>

          {/* 물건 기본 정보 */}
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">🏢 물건 정보</h3>
            <InfoRow icon={MapPin} label="주소" value={property.address} />
            {property.buildingName && <InfoRow icon={Building2} label="건물명" value={property.buildingName} />}
            <InfoRow icon={Layers} label="층수" value={[
              property.floor ? `${property.floor}층` : null,
              property.unit ? `${property.unit}호` : null,
              property.totalFloors ? `(총 ${property.totalFloors}층)` : null
            ].filter(Boolean).join(' ')} />
            {(property.areaExclusive > 0 || property.areaSupply > 0) && (
              <InfoRow icon={SquareStack} label="면적" value={[
                property.areaExclusive > 0 ? `전용 ${property.areaExclusive}㎡` : null,
                property.areaSupply > 0 ? `공급 ${property.areaSupply}㎡` : null
              ].filter(Boolean).join(' / ')} />
            )}
            <InfoRow icon={Tag} label="구역" value={property.zone} />
            {/* 편의시설 태그 */}
            {(property.hasRestaurant || property.parking || property.hasElevator || property.bathroomType) && (
              <div className="flex flex-wrap gap-1.5 py-2 border-b border-slate-100">
                {property.hasRestaurant && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">🍳 식당가능</span>}
                {property.parking && <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-medium">🚗 주차가능</span>}
                {property.hasElevator && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-medium">🛗 엘리베이터</span>}
                {property.bathroomType && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">🚽 화장실: {property.bathroomType}</span>}
              </div>
            )}
          </div>

          {/* 연락처 */}
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">📞 연락처</h3>
            <div className="space-y-2">
              <ContactCard icon={User} label="임대인 / 소유자" phone={property.contactOwner} name={property.ownerName} iconColor="text-blue-600" bgColor="bg-blue-50" />
              <ContactCard icon={User} label="임차인 (현재 영업자)" phone={property.contactTenant} iconColor="text-orange-500" bgColor="bg-orange-50" emptyLabel="공실 (임차인 없음)" />
            </div>
            {(property.manager || property.confirmedDate) && (
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-1.5">
                <User size={12} />
                {property.manager && <span>담당: <span className="font-semibold text-slate-700">{property.manager}</span></span>}
                {property.confirmedDate && <span className="ml-2">확인: <span className="font-semibold text-slate-700">{property.confirmedDate}</span></span>}
              </div>
            )}
            {property.directions && (
              <div className="mt-2 flex items-start gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                <Navigation size={12} className="mt-0.5 flex-shrink-0 text-slate-400" />
                <span>{property.directions}</span>
              </div>
            )}
          </div>

          {/* 비고 */}
          {property.notes && (
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">📋 비고 및 특이사항</h3>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 leading-relaxed whitespace-pre-line">
                {property.notes}
              </div>
            </div>
          )}

          {/* AI 분석 (Gemini) */}
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles size={12} className="text-violet-500" /> AI 매물 분석
              </h3>
              {(aiResult || aiError) && (
                <button
                  onClick={() => setShowAi(v => !v)}
                  className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-0.5"
                >
                  {showAi ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {showAi ? '접기' : '보기'}
                </button>
              )}
            </div>
            {/* 분석 버튼 */}
            {!aiResult && !aiLoading && !aiError && (
              <button
                onClick={handleGeminiAnalyze}
                disabled={!GEMINI_API_KEY}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition shadow-sm"
              >
                <Sparkles size={15} />
                {GEMINI_API_KEY ? 'Gemini로 이 매물 분석하기' : 'API 키 미설정'}
              </button>
            )}
            {/* 캐시된 결과 재분석 버튼 */}
            {aiResult && !aiLoading && (
              <button
                onClick={() => { setAiResult(null); setShowAi(false); try { localStorage.removeItem(`re_gemini_${property.id}`); } catch { /* ignore */ } }}
                className="mt-2 text-xs text-slate-400 hover:text-violet-600 underline transition"
              >🔄 재분석</button>
            )}
            {/* 로딩 */}
            {aiLoading && (
              <div className="flex flex-col items-center justify-center py-6 gap-2 text-violet-600">
                <Loader2 size={24} className="animate-spin" />
                <p className="text-xs font-semibold">Gemini가 분석 중입니다...</p>
              </div>
            )}
            {/* 에러 */}
            {aiError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                {aiError}
                <button
                  onClick={handleGeminiAnalyze}
                  className="block mt-2 text-red-600 underline font-semibold"
                >다시 시도</button>
              </div>
            )}
            {/* 결과 */}
            {aiResult && showAi && (
              <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-4 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                {aiResult}
              </div>
            )}
            {aiResult && showAi && (
              <button
                onClick={handleGeminiAnalyze}
                className="mt-2 text-xs text-violet-500 hover:text-violet-700 underline"
              >다시 분석</button>
            )}
          </div>

          {/* 주변 상권 분석 500m */}
          {Number.isFinite(property.lat) && (
            <div className="p-4 border-b border-slate-100">
              <button
                onClick={() => nearbyData || nearbyLoading ? setShowNearby(v => !v) : handleNearbyAnalysis()}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition"
              >
                <span className="flex items-center gap-1.5"><Store size={13} /> 주변 상권 분석 (반경 500m)</span>
                {nearbyLoading ? <Loader2 size={13} className="animate-spin text-blue-400" /> : (nearbyData ? (showNearby ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null)}
              </button>
              {showNearby && nearbyLoading && (
                <div className="flex items-center justify-center gap-2 py-4 text-blue-500 text-xs">
                  <Loader2 size={16} className="animate-spin" /> 주변 시설 조회 중...
                </div>
              )}
              {showNearby && nearbyError && (
                <p className="text-xs text-red-500 mt-2">{nearbyError}</p>
              )}
              {showNearby && nearbyData && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {nearbyData.map(cat => (
                    <div key={cat.code} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                      <div className="text-lg mb-1">{cat.emoji}</div>
                      <p className="text-xs text-slate-500 font-medium">{cat.label}</p>
                      <p className={`text-xl font-extrabold mt-0.5 ${cat.count > 0 ? 'text-blue-600' : 'text-slate-300'}`}>{cat.count}</p>
                      {cat.top.length > 0 && (
                        <div className="mt-1.5 text-left space-y-0.5">
                          {cat.top.map((name, i) => (
                            <p key={i} className="text-[10px] text-slate-400 truncate">{name}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {showNearby && nearbyData && (
                <p className="text-[10px] text-slate-400 mt-2 text-center">카카오맵 기준 반경 500m 이내 시설 수 (최대 15개)</p>
              )}
            </div>
          )}

          {/* 현장 메모 */}
          <div className="p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <PenLine size={12} /> 현장 메모 (내 기기에만 저장)
            </h3>
            <textarea
              value={memo}
              onChange={handleMemoChange}
              placeholder="현장 방문 메모, 협상 내용, 특이사항 등..."
              rows={3}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 resize-none placeholder-slate-400 text-slate-700"
            />
            {memo && <p className="text-xs text-slate-400 mt-1 text-right">{memo.length}자 · 자동 저장됨</p>}
          </div>
        </div>

        {/* 하단 액션 버튼 */}
        <div className="p-4 border-t border-slate-200 bg-white flex-shrink-0">
          {/* 1행: 카카오맵 + 공유 + 수정 */}
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => {
                const query = encodeURIComponent(property.address);
                window.open(`https://map.kakao.com/?q=${query}`, '_blank', 'noopener,noreferrer');
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-semibold text-sm rounded-xl transition"
            >
              <ExternalLink size={14} /> 카카오맵
            </button>
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold text-sm rounded-xl transition"
              title="매물 정보 복사/공유"
            >
              <Copy size={14} /> 공유
            </button>
            {onEdit && (
              <button
                onClick={() => onEdit(property)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition"
              >
                <Pencil size={14} /> 수정
              </button>
            )}
          </div>
          {/* 2행: AI 분석 버튼 */}
          <div className="mb-2">
            <button
              onClick={() => {
                if (aiResult) { setShowAi(v => !v); } else { handleGeminiAnalyze(); }
              }}
              disabled={aiLoading || !GEMINI_API_KEY}
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-xl transition"
            >
              {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {aiLoading ? 'Gemini 분석 중...' : aiResult ? (showAi ? 'AI 분석 결과 접기' : 'AI 분석 결과 보기') : 'Gemini로 이 매물 분석'}
            </button>
          </div>
          {/* 3행: 블로그 복사 + 인스타 복사 + 인쇄 */}
          <div className="flex gap-2 mb-2">
            <button
              onClick={handleCopyBlog}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-xs rounded-xl transition"
            >
              <BarChart3 size={13} /> 블로그 복사
            </button>
            <button
              onClick={handleCopyInstagram}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 font-semibold text-xs rounded-xl transition"
            >
              <Share2 size={13} /> 인스타 복사
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 font-semibold text-xs rounded-xl transition"
              title="인쇄 / PDF 저장"
            >
              <Printer size={13} /> 인쇄
            </button>
          </div>
          {/* 4행: 완료처리 + 닫기 */}
          <div className="flex gap-2">
            {!property.isCompleted && onComplete && (
              <button
                onClick={() => { onComplete(property.id); onClose(); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-500 hover:bg-slate-600 text-white font-semibold text-sm rounded-xl transition"
              >
                <CheckCircle2 size={15} /> 완료 처리
              </button>
            )}
            {property.isCompleted && onUncomplete && (
              <button
                onClick={() => { onUncomplete(property.id, ''); onClose(); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm rounded-xl transition"
              >
                <RotateCcw size={15} /> 완료 취소
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ContactCard({ icon: Icon, label, phone, name, iconColor, bgColor, emptyLabel }) { // eslint-disable-line no-unused-vars
  const hasPhone = phone && phone.trim() !== '';
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border border-slate-200 ${bgColor}`}>
      <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
        <Icon size={18} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        {name && <p className="text-xs font-semibold text-slate-600 mb-0.5">{name}</p>}
        {hasPhone ? (
          <a href={`tel:${phone.replace(/[^0-9]/g, '')}`} className={`font-bold text-sm ${iconColor} hover:opacity-80 transition`}>
            {phone}
          </a>
        ) : (
          <p className="text-sm text-slate-400 italic">{emptyLabel || '정보 없음'}</p>
        )}
      </div>
      {hasPhone && (
        <a href={`tel:${phone.replace(/[^0-9]/g, '')}`} className={`p-2 rounded-lg ${bgColor} hover:opacity-80 transition`}>
          <Phone size={16} className={iconColor} />
        </a>
      )}
    </div>
  );
}
