import React, { useState, useMemo } from 'react';
import { MapPin, ChevronUp, ChevronDown, Building2, ArrowUpDown, Route, Plus, LayoutList, Layers, Tag, ChevronRight } from 'lucide-react';

const fmt = (n) => (!n && n !== 0 ? '-' : n >= 10000 ? `${(n / 10000).toFixed(1)}억` : `${n.toLocaleString()}만`);

const TYPE_STYLE = {
  임대: { badge: 'bg-blue-100 text-blue-800' },
  매매: { badge: 'bg-rose-100 text-rose-800' },
};

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
      {/* 데스크톱 테이블 헤더 */}
      <div className={`hidden md:grid gap-0 px-4 py-2 bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide sticky top-0 z-10 ${routeMode ? 'grid-cols-13' : 'grid-cols-12'}`}>
        {routeMode && <div className="col-span-1 text-center">경로</div>}
        <div className="col-span-1 text-center">유형</div>
        <div className="col-span-2 text-center">구역</div>
        <div className={routeMode ? 'col-span-2' : 'col-span-3'}>상호명 / 주소</div>
        <div className="col-span-1 text-center">층/면적</div>
        <div className="col-span-2 text-right">보증금</div>
        <div className="col-span-1 text-right">월세</div>
        <div className="col-span-2 text-right">권리금</div>
      </div>

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
            onClick={() => onSelectProperty(prop)}
            onToggleRoute={() => onToggleRoute && onToggleRoute(prop.id)}
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
                  onClick={() => onSelectProperty(prop)}
                  onToggleRoute={() => onToggleRoute && onToggleRoute(prop.id)}
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

// ─── 매물 행 (데스크톱 그리드 & 모바일 카드) ─────────────────────────────
function PropertyRow({ prop, isSelected, isRouteSelected, routeIdx, routeMode, onClick, onToggleRoute, inGroup }) {
  const [showNote, setShowNote] = useState(false);

  const borderClass = isRouteSelected
    ? 'border-l-4 border-l-purple-500 bg-purple-50'
    : isSelected
    ? 'border-l-4 border-l-blue-500 bg-blue-50'
    : prop.isCompleted
    ? 'border-l-4 border-l-slate-400 hover:bg-slate-50'
    : prop.isVacant
    ? 'border-l-4 border-l-green-500 hover:bg-slate-50'
    : prop.type === '매매'
    ? 'border-l-4 border-l-rose-500 hover:bg-slate-50'
    : 'border-l-4 border-l-blue-400 hover:bg-slate-50';

  const typeStyle = TYPE_STYLE[prop.type] || TYPE_STYLE['임대'];

  return (
    <div className={`border-b border-slate-100 transition-colors cursor-pointer ${borderClass} ${prop.isCompleted ? 'opacity-55' : ''} ${inGroup ? 'md:pl-4' : ''}`}>

      {/* ── 모바일 카드 (md 미만에서만 표시) ── */}
      <div className="md:hidden px-4 py-3" onClick={onClick}>
        <div className="flex items-start gap-3">
          {routeMode && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleRoute(); }}
              className={`mt-0.5 w-7 h-7 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold transition
                ${isRouteSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 text-slate-400 hover:border-purple-400'}`}
            >
              {isRouteSelected ? routeIdx + 1 : <Plus size={12} />}
            </button>
          )}
          <div className="flex-1 min-w-0">
            {/* 배지 행 */}
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${typeStyle.badge}`}>{prop.type}</span>
              {prop.zone && <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">{prop.zone}</span>}
              {prop.dong && prop.dong !== prop.zone && <span className="text-xs bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded">{prop.dong}</span>}
              {prop.isVacant   && <span className="text-xs font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">공실</span>}
              {prop.isCompleted && <span className="text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">완료</span>}
            </div>
            {/* 상호명 */}
            <p className={`font-semibold text-sm truncate ${prop.isCompleted ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
              {prop.isCompleted ? '완료매물' : prop.statusOrName || '(상호 미입력)'}
            </p>
            {/* 주소 + 층/면적 */}
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex items-center gap-1 text-xs text-slate-400 min-w-0">
                <MapPin size={10} className="flex-shrink-0" />
                <span className="truncate">{prop.address}</span>
              </div>
              {(prop.floor || prop.areaExclusive) && (
                <span className="text-xs text-slate-400 flex-shrink-0">
                  {prop.floor ? `${prop.floor}층` : ''}{prop.areaExclusive ? ` · ${prop.areaExclusive}㎡` : ''}
                </span>
              )}
            </div>
            {/* 가격 */}
            <div className="flex items-center gap-3 mt-1.5">
              <div><span className="text-xs text-slate-400">보증</span><span className="ml-1 font-bold text-sm text-slate-800">{fmt(prop.deposit)}</span></div>
              <div><span className="text-xs text-slate-400">월세</span><span className="ml-1 font-bold text-sm text-rose-600">{fmt(prop.rent)}</span></div>
              {prop.premium > 0 && <div><span className="text-xs text-slate-400">권리</span><span className="ml-1 font-bold text-sm text-amber-600">{fmt(prop.premium)}</span></div>}
            </div>
          </div>
          {prop.notes && (
            <button className="mt-1 text-blue-400 flex-shrink-0" onClick={(e) => { e.stopPropagation(); setShowNote(!showNote); }}>
              <ChevronDown size={14} className={`transition-transform ${showNote ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
        {showNote && prop.notes && (
          <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900 leading-relaxed">
            📋 {prop.notes}
          </div>
        )}
      </div>

      {/* ── 데스크톱 그리드 (md 이상에서만 표시) ── */}
      <div className={`hidden md:grid gap-0 px-4 py-3 items-center ${routeMode ? 'grid-cols-13' : 'grid-cols-12'}`} onClick={onClick}>
        {routeMode && (
          <div className="col-span-1 flex justify-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onToggleRoute}
              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition font-bold text-xs
                ${isRouteSelected ? 'bg-purple-600 border-purple-600 text-white shadow-md' : 'border-slate-300 text-slate-400 hover:border-purple-400 hover:text-purple-500'}`}
              title={isRouteSelected ? `경로에서 제거` : '경로에 추가'}
            >
              {isRouteSelected ? routeIdx + 1 : <Plus size={12} />}
            </button>
          </div>
        )}
        <div className="col-span-1 flex justify-center">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${typeStyle.badge}`}>{prop.type}</span>
        </div>
        <div className="col-span-2 flex flex-col items-center gap-0.5">
          <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{prop.zone}</span>
          {prop.isVacant   && <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">공실</span>}
          {prop.isCompleted && <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">완료</span>}
        </div>
        <div className={routeMode ? 'col-span-2 min-w-0' : 'col-span-3 min-w-0'}>
          <p className={`font-semibold text-sm truncate ${prop.isCompleted ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
            {prop.isCompleted ? '완료매물' : prop.statusOrName}
          </p>
          <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
            <MapPin size={11} />
            <span className="truncate">{prop.address}</span>
          </div>
        </div>
        <div className="col-span-1 text-center">
          <p className="text-sm font-medium text-slate-700">{prop.floor ? `${prop.floor}층` : '-'}</p>
          <p className="text-xs text-slate-400">{prop.areaExclusive ? `${prop.areaExclusive}㎡` : '-'}</p>
        </div>
        <div className="col-span-2 text-right">
          <p className="font-bold text-slate-800 text-sm">{fmt(prop.deposit)}</p>
        </div>
        <div className="col-span-1 text-right">
          <p className="font-bold text-rose-600 text-sm">{fmt(prop.rent)}</p>
        </div>
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

      {/* 비고 (데스크톱) */}
      {showNote && prop.notes && (
        <div className="hidden md:block px-4 pb-3 -mt-1 cursor-pointer" onClick={onClick}>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900 leading-relaxed">
            <span className="font-semibold text-amber-700 mr-1">📋 비고:</span>{prop.notes}
          </div>
        </div>
      )}
    </div>
  );
}
