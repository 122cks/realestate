import React, { useState } from 'react';
import { MapPin, ChevronUp, ChevronDown, Building2, ArrowUpDown, Route, Plus, Check } from 'lucide-react';

const fmt = (n) => (n >= 10000 ? `${(n / 10000).toFixed(1)}억` : `${n.toLocaleString()}만`);

const TYPE_STYLE = {
  임대: 'bg-blue-100 text-blue-800',
  매매: 'bg-rose-100 text-rose-800',
};

const SORT_OPTIONS = [
  { key: 'default', label: '기본순' },
  { key: 'deposit_asc', label: '보증금 낮은순' },
  { key: 'deposit_desc', label: '보증금 높은순' },
  { key: 'rent_asc', label: '월세 낮은순' },
  { key: 'rent_desc', label: '월세 높은순' },
  { key: 'premium_asc', label: '권리금 낮은순' },
];

function sortProperties(list, sortKey) {
  if (sortKey === 'default') return list;
  const [field, dir] = sortKey.split('_');
  return [...list].sort((a, b) => {
    const fieldMap = { deposit: 'deposit', rent: 'rent', premium: 'premium' };
    const diff = a[fieldMap[field]] - b[fieldMap[field]];
    return dir === 'asc' ? diff : -diff;
  });
}

const PAGE_SIZE = 20;

export default function PropertyList({
  properties,
  selectedId,
  onSelectProperty,
  routeMode = false,
  routeSelection = [],
  onToggleRoute,
}) {
  const [sortKey, setSortKey] = useState('default');
  const [showCount, setShowCount] = useState(PAGE_SIZE);

  const sorted = sortProperties(properties, sortKey);
  const visible = sorted.slice(0, showCount);
  const hasMore = sorted.length > showCount;

  if (properties.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center py-20 text-slate-400">
        <Building2 size={48} className="mb-4 opacity-40" />
        <p className="font-semibold text-slate-500">검색 결과가 없습니다</p>
        <p className="text-sm mt-1">필터 조건을 변경해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 경로 모드 안내 배너 */}
      {routeMode && (
        <div className="px-4 py-2 bg-purple-50 border-b border-purple-200 flex items-center gap-2 text-purple-700">
          <Route size={15} className="flex-shrink-0" />
          <span className="text-xs font-semibold">
            경로 모드 — + 버튼으로 물건 선택 ({routeSelection.length}개 선택 중)
          </span>
        </div>
      )}

      {/* 정렬 옵션 바 */}
      <div className="px-4 py-2 flex items-center gap-2 bg-white border-b border-slate-100">
        <ArrowUpDown size={14} className="text-slate-400" />
        <span className="text-xs text-slate-500 mr-1">정렬:</span>
        <div className="flex gap-1 flex-wrap">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => { setSortKey(opt.key); setShowCount(PAGE_SIZE); }}
              className={`px-2.5 py-1 text-xs rounded-full border transition
                ${sortKey === opt.key
                  ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 테이블 헤더 */}
      <div className={`hidden md:grid gap-0 px-4 py-2 bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide sticky top-0 z-10 ${routeMode ? 'grid-cols-13' : 'grid-cols-12'}`}>
        {routeMode && <div className="col-span-1 text-center">경로</div>}
        <div className={routeMode ? 'col-span-1 text-center' : 'col-span-1 text-center'}>유형</div>
        <div className="col-span-2 text-center">구역</div>
        <div className={routeMode ? 'col-span-2' : 'col-span-3'}>상호명 / 주소</div>
        <div className="col-span-1 text-center">층/면적</div>
        <div className="col-span-2 text-right">보증금</div>
        <div className="col-span-1 text-right">월세</div>
        <div className="col-span-2 text-right">권리금</div>
      </div>

      {/* 매물 목록 */}
      <div className="flex-1 overflow-y-auto">
        {visible.map((prop) => {
          const routeIdx = routeSelection.indexOf(prop.id);
          const isRouteSelected = routeIdx !== -1;
          return (
            <PropertyRow
              key={prop.id}
              prop={prop}
              isSelected={selectedId === prop.id}
              isRouteSelected={isRouteSelected}
              routeIdx={routeIdx}
              routeMode={routeMode}
              onClick={() => onSelectProperty(prop)}
              onToggleRoute={() => onToggleRoute && onToggleRoute(prop.id)}
            />
          );
        })}
        {/* 더 보기 버튼 */}
        {hasMore && (
          <div className="py-3 text-center border-t border-slate-100">
            <button
              onClick={() => setShowCount(n => n + PAGE_SIZE)}
              className="px-4 py-2 text-sm text-blue-600 font-semibold border border-blue-200 rounded-lg hover:bg-blue-50 transition"
            >
              +{Math.min(PAGE_SIZE, sorted.length - showCount)}개 더 보기 ({showCount} / {sorted.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PropertyRow({ prop, isSelected, isRouteSelected, routeIdx, routeMode, onClick, onToggleRoute }) {
  const [showNote, setShowNote] = useState(false);

  const borderClass = isRouteSelected
    ? 'border-l-4 border-l-purple-500 bg-purple-50'
    : isSelected
    ? 'border-l-4 border-l-blue-500 bg-blue-50'
    : 'border-l-4 border-l-transparent hover:bg-slate-50';

  return (
    <div className={`border-b border-slate-100 transition-colors cursor-pointer ${borderClass} ${prop.isCompleted ? 'opacity-60' : ''}`}>
      {/* 메인 행 */}
      <div
        className={`grid gap-0 px-4 py-3 items-center ${routeMode ? 'grid-cols-13' : 'grid-cols-12'}`}
        onClick={onClick}
      >
        {/* 경로 선택 버튼 (경로 모드에서만 표시) */}
        {routeMode && (
          <div className="col-span-1 flex justify-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onToggleRoute}
              disabled={!isRouteSelected && routeIdx === -1 && false}
              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition font-bold text-xs
                ${isRouteSelected
                  ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                  : 'border-slate-300 text-slate-400 hover:border-purple-400 hover:text-purple-500'
                }`}
              title={isRouteSelected ? `경로에서 제거 (${routeIdx + 1}번째)` : '경로에 추가'}
            >
              {isRouteSelected ? routeIdx + 1 : <Plus size={12} />}
            </button>
          </div>
        )}

        {/* 유형 */}
        <div className="col-span-1 flex justify-center">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${TYPE_STYLE[prop.type] || TYPE_STYLE['임대']}`}>
            {prop.type}
          </span>
        </div>

        {/* 구역 + 공실 뱃지 */}
        <div className="col-span-2 flex flex-col items-center gap-0.5">
          <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
            {prop.zone}
          </span>
          {prop.isVacant && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
              공실
            </span>
          )}
          {prop.isCompleted && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">
              완료
            </span>
          )}
        </div>

        {/* 상호명 + 주소 */}
        <div className={routeMode ? 'col-span-2 min-w-0' : 'col-span-3 min-w-0'}>
          <p className={`font-semibold text-sm truncate ${prop.isCompleted ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
            {prop.isCompleted ? '완료매물' : prop.statusOrName}
          </p>
          <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
            <MapPin size={11} />
            <span className="truncate">{prop.address}</span>
          </div>
        </div>

        {/* 층 / 면적 */}
        <div className="col-span-1 text-center">
          <p className="text-sm font-medium text-slate-700">{prop.floor ? `${prop.floor}층` : '-'}</p>
          <p className="text-xs text-slate-400">{prop.areaExclusive ? `${prop.areaExclusive}㎡` : '-'}</p>
        </div>

        {/* 보증금 */}
        <div className="col-span-2 text-right">
          <p className="font-bold text-slate-800 text-sm">{fmt(prop.deposit)}</p>
        </div>

        {/* 월세 */}
        <div className="col-span-1 text-right">
          <p className="font-bold text-rose-600 text-sm">{fmt(prop.rent)}</p>
        </div>

        {/* 권리금 */}
        <div className="col-span-2 text-right flex flex-col items-end">
          <p className={`font-bold text-sm ${prop.premium > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
            {prop.premium > 0 ? fmt(prop.premium) : '없음'}
          </p>
          {prop.notes && (
            <button
              className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5 mt-0.5 transition"
              onClick={(e) => { e.stopPropagation(); setShowNote(!showNote); }}
            >
              비고 {showNote ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          )}
        </div>
      </div>

      {/* 비고 내용 (접기/펼치기) */}
      {showNote && prop.notes && (
        <div className="px-4 pb-3 -mt-1 cursor-pointer" onClick={onClick}>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900 leading-relaxed">
            <span className="font-semibold text-amber-700 mr-1">📋 비고:</span>
            {prop.notes}
          </div>
        </div>
      )}
    </div>
  );
}
