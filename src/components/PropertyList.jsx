import React, { useState, useMemo, memo, useCallback } from 'react';
import { MapPin, Building2, ArrowUpDown, Route, Plus, LayoutList, Layers, Tag, ChevronRight } from 'lucide-react';

const fmt = (n) => (!n && n !== 0 ? '-' : n >= 10000 ? `${(n / 10000).toFixed(1)}억` : `${n.toLocaleString()}만`);
const toPyeong = (m2) => (m2 > 0 ? `${(m2 / 3.30579).toFixed(1)}평` : null);


const SORT_OPTIONS = [
  { key: 'default',      label: '기본순' },
  { key: 'deposit_asc',  label: '보증↑' },
  { key: 'deposit_desc', label: '보증↓' },
  { key: 'rent_asc',     label: '월세↑' },
  { key: 'rent_desc',    label: '월세↓' },
  { key: 'premium_asc',  label: '권리↑' },
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

const PAGE_SIZE = 100;

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────
export default function PropertyList({
  properties,
  selectedId,
  onSelectProperty,
  routeMode = false,
  routeSelection = [],
  onToggleRoute,
}) {
  const [sortKey, setSortKey]     = useState('default');
  const [showCount, setShowCount] = useState(PAGE_SIZE);
  const [viewMode, setViewMode]   = useState('list'); // 'list' | 'byDong' | 'byZone'

  const sorted = useMemo(() => sortProperties(properties, sortKey), [properties, sortKey]);

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
      {/* 경로 모드 배너 */}
      {routeMode && (
        <div className="px-4 py-2 bg-purple-50 border-b border-purple-200 flex items-center gap-2 text-purple-700 flex-shrink-0">
          <Route size={15} className="flex-shrink-0" />
          <span className="text-xs font-semibold">
            경로 모드 — + 버튼으로 물건 선택 ({routeSelection.length}개 선택 중)
          </span>
        </div>
      )}

      {/* 뷰 모드 토글 + 정렬 바 */}
      <div className="px-3 py-2 flex items-center gap-2 bg-white border-b border-slate-100 flex-shrink-0 flex-wrap">
        {/* 뷰 모드 토글 */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold flex-shrink-0">
          {[
            { key: 'list',   label: '목록',  icon: <LayoutList size={12} /> },
            { key: 'byDong', label: '동별',  icon: <Layers size={12} /> },
            { key: 'byZone', label: '구역별', icon: <Tag size={12} /> },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => { setViewMode(opt.key); setShowCount(PAGE_SIZE); }}
              className={`flex items-center gap-1 px-2.5 py-1.5 transition
                ${viewMode === opt.key
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 hover:bg-slate-50'
                }`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>

        {/* 정렬 */}
        <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0" style={{scrollbarWidth:'none'}}>
          <ArrowUpDown size={12} className="text-slate-400 flex-shrink-0" />
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => { setSortKey(opt.key); setShowCount(PAGE_SIZE); }}
              className={`px-2 py-1 text-xs rounded-full border whitespace-nowrap transition flex-shrink-0
                ${sortKey === opt.key
                  ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-400 flex-shrink-0">{properties.length}건</span>
      </div>

      {/* 뷰 본문 */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === 'list' ? (
          <ListView
            sorted={sorted}
            showCount={showCount}
            setShowCount={setShowCount}
            selectedId={selectedId}
            onSelectProperty={onSelectProperty}
            routeMode={routeMode}
            routeSelection={routeSelection}
            onToggleRoute={onToggleRoute}
          />
        ) : (
          <GroupedView
            sorted={sorted}
            groupBy={viewMode === 'byDong' ? 'dong' : 'zone'}
            selectedId={selectedId}
            onSelectProperty={onSelectProperty}
            routeMode={routeMode}
            routeSelection={routeSelection}
            onToggleRoute={onToggleRoute}
          />
        )}
      </div>
    </div>
  );
}

// ─── 리스트 뷰 ────────────────────────────────────────────────────────────
function ListView({ sorted, showCount, setShowCount, selectedId, onSelectProperty, routeMode, routeSelection, onToggleRoute }) {
  const visible = sorted.slice(0, showCount);
  const hasMore = sorted.length > showCount;
  return (
    <>
      {visible.map((prop) => {
        const routeIdx = routeSelection.indexOf(prop.id);
        return (
          <PropertyRow
            key={prop.id}
            prop={prop}
            isSelected={selectedId === prop.id}
            isRouteSelected={routeIdx !== -1}
            routeIdx={routeIdx}
            routeMode={routeMode}
            onSelectProperty={onSelectProperty}
            onToggleRoute={onToggleRoute}
          />
        );
      })}

      {hasMore && (
        <div className="py-3 text-center border-t border-slate-100">
          <button
            onClick={() => setShowCount(n => n + PAGE_SIZE)}
            className="px-4 py-2 text-sm text-blue-600 font-semibold border border-blue-200 rounded-lg hover:bg-blue-50 transition"
          >
            +{Math.min(PAGE_SIZE, sorted.length - showCount)}개 더 보기 ({showCount}/{sorted.length})
          </button>
        </div>
      )}
    </>
  );
}

// ─── 그룹 뷰 ─────────────────────────────────────────────────────────────
function GroupedView({ sorted, groupBy, selectedId, onSelectProperty, routeMode, routeSelection, onToggleRoute }) {
  const groups = useMemo(() => {
    const map = new Map();
    for (const p of sorted) {
      const key = (p[groupBy] || '미분류').trim() || '미분류';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [sorted, groupBy]);

  const [collapsed, setCollapsed] = useState({});
  const toggle = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  const getStats = (items) => ({
    total:  items.length,
    vacant: items.filter(p => p.isVacant && !p.isCompleted).length,
    rent:   items.filter(p => p.type === '임대' && !p.isVacant && !p.isCompleted).length,
    sale:   items.filter(p => p.type === '매매' && !p.isCompleted).length,
  });

  return (
    <div>
      {groups.map(([groupKey, items]) => {
        const isOpen = !collapsed[groupKey];
        const stats = getStats(items);
        return (
          <div key={groupKey} className="border-b border-slate-100">
            {/* 그룹 헤더 */}
            <button
              onClick={() => toggle(groupKey)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition sticky top-0 z-10"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <ChevronRight size={15} className={`text-slate-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                <span className="font-bold text-slate-800 text-sm truncate">{groupKey}</span>
                <span className="text-xs text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full flex-shrink-0">
                  {stats.total}건
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                {stats.vacant > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">공실 {stats.vacant}</span>}
                {stats.rent   > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">임대 {stats.rent}</span>}
                {stats.sale   > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-semibold">매매 {stats.sale}</span>}
              </div>
            </button>

            {isOpen && items.map((prop) => {
              const routeIdx = routeSelection.indexOf(prop.id);
              return (
                <PropertyRow
                  key={prop.id}
                  prop={prop}
                  isSelected={selectedId === prop.id}
                  isRouteSelected={routeIdx !== -1}
                  routeIdx={routeIdx}
                  routeMode={routeMode}
                  onSelectProperty={onSelectProperty}
                  onToggleRoute={onToggleRoute}
                  inGroup
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── 매물 행 (네이버 부동산 스타일 통합 카드) ─────────────────────────────
const PropertyRow = memo(function PropertyRow({ prop, isSelected, isRouteSelected, routeIdx, routeMode, onSelectProperty, onToggleRoute, inGroup }) {
  const [showNote, setShowNote] = useState(false);

  const handleClick = useCallback(() => onSelectProperty(prop), [onSelectProperty, prop]);
  const handleToggle = useCallback((e) => {
    e.stopPropagation();
    onToggleRoute && onToggleRoute(prop.id);
  }, [onToggleRoute, prop.id]);
  const handleNoteToggle = useCallback((e) => { e.stopPropagation(); setShowNote(v => !v); }, []);

  const borderClass = isRouteSelected
    ? 'border-l-4 border-l-purple-500 bg-purple-50'
    : isSelected
    ? 'border-l-4 border-l-blue-500 bg-blue-50'
    : prop.isCompleted
    ? 'border-l-4 border-l-slate-300 hover:bg-slate-50'
    : prop.isVacant
    ? 'border-l-4 border-l-green-500 hover:bg-slate-50'
    : prop.type === '매매'
    ? 'border-l-4 border-l-rose-500 hover:bg-slate-50'
    : 'border-l-4 border-l-blue-400 hover:bg-slate-50';

  const typeBadgeCls = prop.isCompleted ? 'bg-slate-200 text-slate-500'
    : prop.isVacant ? 'bg-green-100 text-green-700'
    : prop.type === '매매' ? 'bg-rose-100 text-rose-700'
    : 'bg-blue-100 text-blue-700';
  const typeLabel = prop.isCompleted ? '완료' : prop.isVacant ? '공실' : (prop.type || '임대');

  // 가격 노드 — 네이버 스타일
  const priceNode = prop.isCompleted
    ? <span className="font-bold text-slate-400 text-sm">완료</span>
    : prop.type === '매매'
    ? <span className="font-bold text-rose-600 text-sm">매매 {fmt(prop.deposit)}</span>
    : <span className="text-sm leading-none">
        <span className="font-bold text-slate-800">{fmt(prop.deposit)}</span>
        <span className="text-slate-300 mx-0.5">/</span>
        <span className="font-bold text-rose-600">{fmt(prop.rent)}</span>
        <span className="text-xs text-slate-400">만</span>
      </span>;

  const py = toPyeong(prop.areaExclusive);
  const featureTags = [
    prop.parking && '🅿️ 주차',
    prop.hasElevator && '🔼 엘베',
    prop.hasRestaurant && '🍽 식당가능',
  ].filter(Boolean);

  return (
    <div className={`border-b border-slate-100 transition-colors cursor-pointer ${borderClass} ${prop.isCompleted ? 'opacity-55' : ''}`}>
      <div className={`px-4 py-3 ${inGroup ? 'pl-6' : ''}`} onClick={handleClick}>

        {/* 상단: 유형배지 + 구역 + 가격 */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {routeMode && (
              <button
                onClick={handleToggle}
                className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold transition
                  ${isRouteSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 text-slate-400 hover:border-purple-400'}`}
              >
                {isRouteSelected ? routeIdx + 1 : <Plus size={10} />}
              </button>
            )}
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${typeBadgeCls}`}>{typeLabel}</span>
            {prop.zone && <span className="text-xs text-slate-400 truncate">{prop.zone}</span>}
            {prop.dong && <span className="text-xs text-slate-300 truncate">· {prop.dong}</span>}
          </div>
          <div className="flex-shrink-0">{priceNode}</div>
        </div>

        {/* 상호명 */}
        <p className={`font-semibold text-sm leading-tight truncate ${prop.isCompleted ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
          {prop.statusOrName || '(상호 미입력)'}
        </p>

        {/* 면적 · 층 · 주소 */}
        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 flex-wrap">
          {prop.areaExclusive > 0 && (
            <span className="font-medium">{prop.areaExclusive}㎡{py ? ` (${py})` : ''}</span>
          )}
          {prop.floor && (
            <span>{prop.floor}층{prop.totalFloors ? `/${prop.totalFloors}층` : ''}</span>
          )}
          {prop.address && (
            <span className="flex items-center gap-0.5 text-slate-400 min-w-0 truncate">
              <MapPin size={9} className="flex-shrink-0" />
              <span className="truncate">{prop.address}</span>
            </span>
          )}
        </div>

        {/* 비고 스니펫 */}
        {prop.notes && (
          <div className="mt-1.5">
            <div
              className={`text-xs bg-amber-50 text-amber-800 px-2.5 py-1.5 rounded leading-relaxed ${showNote ? '' : 'truncate'}`}
            >
              📋 {prop.notes}
            </div>
            {prop.notes.length > 60 && (
              <button
                className="text-xs text-slate-400 hover:text-slate-600 mt-0.5"
                onClick={handleNoteToggle}
              >
                {showNote ? '접기 ↑' : '더 보기 ↓'}
              </button>
            )}
          </div>
        )}

        {/* 하단: 특이사항 태그 + 관리비/권리금 + 담당/확인일 */}
        <div className="flex items-center justify-between gap-2 mt-2">
          <div className="flex items-center gap-1 flex-wrap min-w-0">
            {featureTags.map(t => (
              <span key={t} className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded whitespace-nowrap">{t}</span>
            ))}
            {prop.premium > 0 && (
              <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded whitespace-nowrap">권리 {fmt(prop.premium)}</span>
            )}
            {prop.maintenanceFee > 0 && (
              <span className="text-xs bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded whitespace-nowrap">관리비 {fmt(prop.maintenanceFee)}</span>
            )}
            {prop.approxLocation && (
              <span className="text-xs text-amber-500 whitespace-nowrap">📍 대략위치</span>
            )}
          </div>
          {(prop.confirmedDate || prop.manager) && (
            <div className="text-xs text-slate-400 flex-shrink-0 text-right whitespace-nowrap">
              {prop.confirmedDate && <span>확인 {prop.confirmedDate}</span>}
              {prop.manager && <span> · {prop.manager}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
