import React from 'react';
import { Navigation, X, MapPin, CheckCircle2, AlertCircle, Clock, Car, Footprints, Trash2 } from 'lucide-react';
import { walkMinutes, driveMinutes } from '../utils/routeOptimizer';

const fmt = (n) => {
  if (!n && n !== 0) return '-';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}억`;
  return `${n.toLocaleString()}만`;
};

export default function RoutePanel({
  properties,
  routeSelection,
  routeResult,
  onToggleRoute,
  onClear,
  onClose,
}) {
  const selectedProps = (properties || []).filter((p) => routeSelection.includes(p.id));

  return (
    <div className="flex flex-col bg-white border-t-2 border-indigo-400 shadow-xl" style={{ maxHeight: '320px' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-600 text-white">
        <div className="flex items-center gap-2">
          <Navigation size={16} />
          <span className="font-bold text-sm">경로 최적화</span>
          <span className="text-indigo-200 text-xs">({routeSelection.length}개 선택)</span>
        </div>
        <div className="flex items-center gap-2">
          {routeSelection.length > 0 && (
            <button
              onClick={onClear}
              className="flex items-center gap-1 text-xs text-indigo-200 hover:text-white transition"
            >
              <Trash2 size={12} /> 초기화
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded-full hover:bg-indigo-500 transition">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {routeSelection.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
            <MapPin size={28} className="opacity-40" />
            <p className="text-sm font-medium">매물을 2개 이상 선택해 경로를 계산하세요</p>
            <p className="text-xs text-center px-6">목록에서 <span className="text-indigo-500 font-semibold">경로 추가(+)</span> 버튼을 클릭하거나<br />지도에서 매물 마커를 클릭하세요</p>
          </div>
        ) : (
          <div className="p-3 flex flex-col gap-2">
            {/* 선택된 매물 칩 목록 */}
            <div className="flex flex-wrap gap-1.5 mb-1">
              {selectedProps.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onToggleRoute(p.id)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 border border-indigo-200 hover:bg-red-50 hover:border-red-300 text-indigo-700 hover:text-red-600 rounded-full text-xs font-semibold transition group"
                  title="클릭해서 제거"
                >
                  {p.zone} · {(p.statusOrName || '').slice(0, 8)}
                  <X size={10} className="opacity-50 group-hover:opacity-100" />
                </button>
              ))}
            </div>

            {/* 결과: 2개 미만이면 안내 */}
            {routeSelection.length < 2 ? (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
                <AlertCircle size={14} />
                최소 2개 이상 선택해야 경로를 계산할 수 있습니다
              </div>
            ) : routeResult ? (
              <RouteResult result={routeResult} />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function RouteResult({ result }) {
  const { route, totalKm, skipped } = result;

  return (
    <div className="space-y-2">
      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={MapPin} label="총 거리" value={`${totalKm} km`} color="text-indigo-600" bg="bg-indigo-50" />
        <StatCard icon={Car} label="자동차" value={`약 ${driveMinutes(totalKm)}분`} color="text-blue-600" bg="bg-blue-50" />
        <StatCard icon={Footprints} label="도보" value={`약 ${walkMinutes(totalKm)}분`} color="text-emerald-600" bg="bg-emerald-50" />
      </div>

      {skipped > 0 && (
        <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs">
          <AlertCircle size={12} />
          좌표 없어서 제외된 매물: {skipped}개 (지오코딩 완료 후 재시도하세요)
        </div>
      )}

      {/* 최적 순서 */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-3">
        <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2 flex items-center gap-1">
          <CheckCircle2 size={12} /> 최적 방문 순서
        </p>
        <div className="space-y-1.5">
          {route.map((prop, idx) => (
            <div key={prop.id} className="flex items-center gap-2.5">
              <div className="w-6 h-6 flex-shrink-0 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{prop.statusOrName}</p>
                <p className="text-xs text-slate-500 truncate">{prop.zone} · {prop.address}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-bold text-slate-700">{fmt(prop.rent)}</p>
                <p className="text-xs text-slate-400">월세</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 카카오맵으로 길찾기 링크 */}
      {route.length >= 2 && (
        <a
          href={buildKakaoNavUrl(route)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold text-sm rounded-xl transition"
        >
          🗺️ 카카오맵에서 길찾기
        </a>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div className={`${bg} rounded-lg p-2 text-center`}>
      <Icon size={14} className={`${color} mx-auto mb-0.5`} />
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm font-extrabold ${color}`}>{value}</p>
    </div>
  );
}

/** 카카오맵 멀티 경유지 URL (최대 5개) */
function buildKakaoNavUrl(route) {
  if (!route || route.length < 2) return '#';
  const origin = route[0];
  const dest = route[route.length - 1];
  const waypoints = route.slice(1, -1);

  let url = `https://map.kakao.com/?sName=${encodeURIComponent(origin.statusOrName || origin.address)}&eName=${encodeURIComponent(dest.statusOrName || dest.address)}`;
  if (waypoints.length > 0) {
    url += `&viaList=${waypoints.map((p) => encodeURIComponent(p.statusOrName || p.address)).join(',')}`;
  }
  return url;
}
