import React, { useMemo } from 'react';
import { X, TrendingUp, BarChart2, PieChart as PieIcon, Target } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
  ScatterChart, Scatter, ReferenceLine,
} from 'recharts';

const PIE_COLORS = {
  임대: '#3b82f6',
  매매: '#ef4444',
  공실: '#22c55e',
  완료: '#94a3b8',
};

const fmt = (n) => {
  if (!n && n !== 0) return '-';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}억`;
  return `${n.toLocaleString()}만`;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-slate-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.fill || p.color }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' && p.value > 100 ? fmt(p.value) : p.value}
          {p.name.includes('월세') || p.name.includes('보증금') ? '만원' : '개'}
        </p>
      ))}
    </div>
  );
};

export default function StatsPanel({ properties, onClose }) {
  const stats = useMemo(() => {
    if (!properties || properties.length === 0) return null;

    const all = properties;
    const completed = all.filter(p => p.isCompleted);
    const active = all.filter(p => !p.isCompleted);
    const vacant = active.filter(p => p.isVacant);
    const rentItems = active.filter(p => p.type === '임대' && !p.isVacant);
    const saleItems = active.filter(p => p.type === '매매');

    // 유형 분포 파이
    const typeData = [
      { name: '임대', value: rentItems.length },
      { name: '매매', value: saleItems.length },
      { name: '공실', value: vacant.length },
      { name: '완료', value: completed.length },
    ].filter(d => d.value > 0);

    // 구역별 매물 수 바 차트
    const zoneMap = {};
    for (const p of active) {
      const z = p.zone || '기타';
      if (!zoneMap[z]) zoneMap[z] = { name: z, 임대: 0, 매매: 0, 공실: 0 };
      if (p.isVacant) zoneMap[z].공실++;
      else if (p.type === '매매') zoneMap[z].매매++;
      else zoneMap[z].임대++;
    }
    const zoneData = Object.values(zoneMap)
      .sort((a, b) => (b.임대 + b.매매 + b.공실) - (a.임대 + a.매매 + a.공실))
      .slice(0, 10);

    // 구역별 평균 월세 (임대 기준, 최소 2건 이상)
    const avgMap = {};
    for (const p of rentItems.filter(p => p.rent > 0)) {
      const z = p.zone || '기타';
      if (!avgMap[z]) avgMap[z] = { name: z, cnt: 0, rentSum: 0, depSum: 0 };
      avgMap[z].cnt++;
      avgMap[z].rentSum += p.rent;
      avgMap[z].depSum += p.deposit;
    }
    const avgData = Object.values(avgMap)
      .filter(z => z.cnt >= 2)
      .map(z => ({
        name: z.name,
        평균월세: Math.round(z.rentSum / z.cnt),
        평균보증금: Math.round(z.depSum / z.cnt),
      }))
      .sort((a, b) => b.평균월세 - a.평균월세)
      .slice(0, 8);

    // 전체 평균
    const avgRent = rentItems.filter(p => p.rent > 0).reduce((s, p) => s + p.rent, 0) / (rentItems.filter(p => p.rent > 0).length || 1);
    const avgDeposit = rentItems.filter(p => p.deposit > 0).reduce((s, p) => s + p.deposit, 0) / (rentItems.filter(p => p.deposit > 0).length || 1);

    // ROI 분포 (임대+매매, 투자금 > 0인 항목만)
    const roiBuckets = { '3% 미만': 0, '3~5%': 0, '5~7%': 0, '7~10%': 0, '10% 이상': 0 };
    const roiItems = [];
    for (const p of active.filter(p => !p.isVacant)) {
      const totalInv = (p.deposit || 0) + (p.premium || 0);
      const annualRent = (p.rent || 0) * 12;
      if (totalInv > 0 && annualRent > 0) {
        const roi = (annualRent / totalInv) * 100;
        roiItems.push({ id: p.id, name: p.statusOrName || p.address, roi: +roi.toFixed(2), zone: p.zone || '기타' });
        if (roi < 3) roiBuckets['3% 미만']++;
        else if (roi < 5) roiBuckets['3~5%']++;
        else if (roi < 7) roiBuckets['5~7%']++;
        else if (roi < 10) roiBuckets['7~10%']++;
        else roiBuckets['10% 이상']++;
      }
    }
    const roiDistData = Object.entries(roiBuckets).map(([name, value]) => ({ name, value }));
    const highRoiCount = roiItems.filter(r => r.roi >= 5).length;
    const avgRoi = roiItems.length > 0 ? (roiItems.reduce((s, r) => s + r.roi, 0) / roiItems.length).toFixed(1) : null;

    return { all, active, completed, vacant, rentItems, saleItems, typeData, zoneData, avgData, avgRent, avgDeposit, roiDistData, roiItems, highRoiCount, avgRoi };
  }, [properties]);

  if (!stats) return null;

  const vacancyRate = stats.active.length > 0 ? Math.round((stats.vacant.length / stats.active.length) * 100) : 0;

  return (
    <>
      {/* 배경 오버레이 */}
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />

      {/* 패널 */}
      <div className="fixed top-0 right-0 h-full w-full max-w-2xl bg-slate-50 shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <BarChart2 size={20} className="text-indigo-400" />
            <div>
              <h2 className="text-base font-bold">매물 통계 대시보드</h2>
              <p className="text-xs text-slate-400">전체 {stats.all.length}건 분석</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition">
            <X size={18} />
          </button>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* 요약 카드 */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '활성 매물', value: stats.active.length, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
              { label: '공실', value: stats.vacant.length, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
              { label: '완료 처리', value: stats.completed.length, color: 'text-slate-500', bg: 'bg-slate-100 border-slate-200' },
              { label: '공실률', value: `${vacancyRate}%`, color: vacancyRate > 20 ? 'text-rose-600' : 'text-emerald-600', bg: 'bg-white border-slate-200' },
            ].map(c => (
              <div key={c.label} className={`rounded-xl border p-3 text-center ${c.bg}`}>
                <p className={`text-2xl font-extrabold ${c.color}`}>{c.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>

          {/* 평균 시세 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-400 mb-1">임대 평균 월세</p>
              <p className="text-xl font-extrabold text-rose-600">{fmt(Math.round(stats.avgRent))}<span className="text-sm font-normal text-slate-400">만원</span></p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-400 mb-1">임대 평균 보증금</p>
              <p className="text-xl font-extrabold text-blue-600">{fmt(Math.round(stats.avgDeposit))}<span className="text-sm font-normal text-slate-400">만원</span></p>
            </div>
          </div>

          {/* 유형 분포 파이 */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
              <PieIcon size={15} className="text-blue-500" />
              매물 유형 분포
            </h3>
            <div className="flex items-center">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={stats.typeData} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                    dataKey="value" paddingAngle={3}>
                    {stats.typeData.map(entry => (
                      <Cell key={entry.name} fill={PIE_COLORS[entry.name] || '#6366f1'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v}건`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2 pl-2">
                {stats.typeData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[d.name] }} />
                      <span className="text-slate-600">{d.name}</span>
                    </div>
                    <span className="font-bold text-slate-800">{d.value}<span className="text-xs font-normal text-slate-400">건</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 구역별 매물 수 */}
          {stats.zoneData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                <BarChart2 size={15} className="text-indigo-500" />
                구역별 매물 수
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.zoneData} barSize={14} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="임대" stackId="a" fill="#3b82f6" radius={[0,0,0,0]} />
                  <Bar dataKey="매매" stackId="a" fill="#ef4444" radius={[0,0,0,0]} />
                  <Bar dataKey="공실" stackId="a" fill="#22c55e" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 구역별 평균 시세 */}
          {stats.avgData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                <TrendingUp size={15} className="text-rose-500" />
                구역별 평균 시세 (임대)
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.avgData} barSize={14} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="만" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="평균월세" fill="#f87171" radius={[3,3,0,0]} />
                  <Bar dataKey="평균보증금" fill="#60a5fa" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-slate-400 mt-2">* 2건 이상 데이터가 있는 구역만 표시</p>
            </div>
          )}

          {/* 투자 수익률(ROI) 분포 */}
          {stats.roiDistData.some(d => d.value > 0) && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Target size={15} className="text-emerald-500" />
                투자 수익률(ROI) 분포
              </h3>
              <p className="text-xs text-slate-400 mb-3">월세×12 ÷ (보증금+권리금) — 투자금 있는 매물 기준</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-emerald-600 font-medium">평균 ROI</p>
                  <p className="text-xl font-extrabold text-emerald-700">{stats.avgRoi ?? '-'}<span className="text-sm font-normal">%</span></p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-blue-600 font-medium">ROI ≥ 5%</p>
                  <p className="text-xl font-extrabold text-blue-700">{stats.highRoiCount}<span className="text-sm font-normal text-slate-400">건</span></p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500 font-medium">분석 대상</p>
                  <p className="text-xl font-extrabold text-slate-700">{stats.roiItems.length}<span className="text-sm font-normal text-slate-400">건</span></p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={stats.roiDistData} barSize={28} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [`${v}건`, '매물 수']} />
                  <Bar dataKey="value" radius={[4,4,0,0]}>
                    {stats.roiDistData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          entry.name === '10% 이상' ? '#059669' :
                          entry.name === '7~10%'   ? '#10b981' :
                          entry.name === '5~7%'    ? '#6ee7b7' :
                          entry.name === '3~5%'    ? '#fbbf24' :
                          '#f87171'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {stats.roiItems.length > 0 && (
                <div className="mt-3 space-y-1 max-h-36 overflow-y-auto">
                  <p className="text-xs font-semibold text-slate-500 mb-1">ROI 상위 매물</p>
                  {[...stats.roiItems].sort((a, b) => b.roi - a.roi).slice(0, 5).map(r => (
                    <div key={r.id} className="flex items-center justify-between text-xs py-0.5 border-b border-slate-100">
                      <span className="text-slate-600 truncate max-w-[60%]">{r.name}</span>
                      <span className={`font-bold ${r.roi >= 8 ? 'text-emerald-600' : r.roi >= 5 ? 'text-blue-600' : 'text-slate-500'}`}>{r.roi}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
