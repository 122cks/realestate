import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Search, SlidersHorizontal, RotateCcw, ChevronDown, ChevronUp, Download } from 'lucide-react';

export default function FilterBar({ filters, onUpdate, onReset, totalCount, filteredCount, zones, managers, onExportCSV }) {
  const [isExpanded, setIsExpanded] = useState(false);
  // 검색어 디바운스: 로컨 타이핑 중 직접 상태 변경 없이 250ms 후 반영
  const [localSearch, setLocalSearch] = useState(filters.searchTerm || '');
  const debounceRef = useRef(null);

  // 외부(예: 초기화) 에서 filters.searchTerm 변경 시 동기화
  useEffect(() => { setLocalSearch(filters.searchTerm || ''); }, [filters.searchTerm]);

  const handleSearchChange = useCallback((e) => {
    const val = e.target.value;
    setLocalSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onUpdate('searchTerm', val), 250);
  }, [onUpdate]);

  const zoneOptions = zones && zones.length > 0
    ? ['전체', ...zones.filter(z => z !== '전체')]
    : ['전체'];

  const managerOptions = managers && managers.length > 0
    ? ['전체', ...managers.filter(m => m && m !== '전체').sort()]
    : ['전체'];

  // 파생 카테고리(레거시 필터 호환): filters.categories가 있으면 우선 사용,
  // 없으면 기존 filters.type / isVacantOnly / showCompleted로 유추
  const derivedCategories = useMemo(() => {
    if (Array.isArray(filters.categories) && filters.categories.length > 0) return filters.categories;
    const set = new Set();
    if (filters.isVacantOnly) {
      set.add('공실');
    } else {
      if (!filters.type || filters.type === '전체') {
        set.add('임대'); set.add('매매'); set.add('공실');
      } else {
        set.add(filters.type);
        set.add('공실');
      }
    }
    if (filters.showCompleted) set.add('완료');
    return Array.from(set);
  }, [filters]);

  const handleToggleCategory = useCallback((cat) => {
    const cur = new Set(derivedCategories);
    if (cur.has(cat)) cur.delete(cat); else cur.add(cat);
    const next = Array.from(cur);
    onUpdate('categories', next);
    // 레거시 필터 동기화: type / isVacantOnly / showCompleted
    const hasRent = next.includes('임대');
    const hasSale = next.includes('매매');
    const onlyVacant = next.length === 1 && next[0] === '공실';
    const nextType = (hasRent && !hasSale) ? '임대' : (!hasRent && hasSale) ? '매매' : '전체';
    onUpdate('type', nextType);
    onUpdate('isVacantOnly', onlyVacant);
    onUpdate('showCompleted', next.includes('완료'));
  }, [derivedCategories, onUpdate]);

  return (
    <div className="bg-white border-b border-slate-200 shadow-sm">
      {/* 메인 검색 바 */}
      <div className="px-3 py-2 flex flex-col gap-1.5">
        {/* 행 1: 검색 입력 + 액션 버튼 */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="구역·상호·주소 검색..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              value={localSearch}
              onChange={handleSearchChange}
            />
          </div>

          {/* 상세 필터 토글 */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center gap-1 px-2.5 py-2 text-sm font-medium rounded-lg border transition flex-shrink-0
              ${isExpanded ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
          >
            <SlidersHorizontal size={15} />
            <span className="hidden sm:inline">상세</span>
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {/* 초기화 */}
          <button onClick={onReset} className="p-2 text-slate-500 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition flex-shrink-0" title="필터 초기화">
            <RotateCcw size={15} />
          </button>

          {/* CSV */}
          {onExportCSV && (
            <button onClick={onExportCSV} className="flex items-center gap-1 px-2 py-2 text-xs text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-50 transition font-medium flex-shrink-0" title="CSV 내보내기">
              <Download size={14} />
              <span className="hidden sm:inline">CSV</span>
            </button>
          )}
        </div>

        {/* 행 2 (모바일): 구역 + 담당자 드롭다운 */}
        <div className="flex items-center gap-1.5">
          <select
            className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer transition"
            value={filters.zone}
            onChange={(e) => onUpdate('zone', e.target.value)}
          >
            {zoneOptions.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>

          {managerOptions.length > 1 && (
            <select
              className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer transition"
              value={filters.manager || '전체'}
              onChange={(e) => onUpdate('manager', e.target.value)}
            >
              {managerOptions.map((m) => (
                <option key={m} value={m}>{m === '전체' ? '담당 전체' : `담당: ${m}`}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 빠른 필터 토글 행 — 카테고리 */}
      <div className="px-4 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 카테고리 버튼 그룹 */}
          {['임대','매매','공실','완료'].map((cat) => {
            const active = derivedCategories.includes(cat);
            const base = active ? 'text-white font-semibold' : 'text-slate-600';
            const bg = active
              ? (cat === '임대' ? 'bg-blue-600' : cat === '매매' ? 'bg-rose-600' : cat === '공실' ? 'bg-green-500' : 'bg-slate-500')
              : 'bg-white border border-slate-200';
            return (
              <button
                key={cat}
                onClick={() => handleToggleCategory(cat)}
                className={`${bg} ${base} px-3 py-1.5 rounded-full text-sm transition`}
                aria-pressed={active}
                title={`토글 ${cat}`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* 검색 결과 카운트 */}
        <span className="text-xs text-slate-500">
          총 <span className="font-bold text-blue-600">{filteredCount}</span>개
          {filteredCount !== totalCount && <span className="text-slate-400"> / {totalCount}개</span>}
        </span>
      </div>

      {/* 지역 필터 버튼 행 */}
      <div className="px-3 pb-2 flex items-center gap-1.5 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
        <span className="text-xs text-slate-400 flex-shrink-0 mr-0.5">지역</span>
        {['전체', '인천시', '부천시', '부평구', '계양구', '서구'].map((r) => {
          const active = (filters.region || '전체') === r;
          return (
            <button
              key={r}
              onClick={() => onUpdate('region', r)}
              className={`px-2.5 py-1 text-xs rounded-full border whitespace-nowrap transition flex-shrink-0 font-medium
                ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {r}
            </button>
          );
        })}
      </div>

      {/* 상세 필터 패널 (접기/펼치기) */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 bg-slate-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {/* 보증금 범위 */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                보증금 (만원)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  placeholder="최소"
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={filters.depositMin}
                  onChange={(e) => onUpdate('depositMin', e.target.value)}
                />
                <span className="text-slate-400 text-xs">~</span>
                <input
                  type="number"
                  placeholder="최대"
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={filters.depositMax}
                  onChange={(e) => onUpdate('depositMax', e.target.value)}
                />
              </div>
            </div>

            {/* 월세 범위 */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                월세 (만원)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  placeholder="최소"
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={filters.rentMin}
                  onChange={(e) => onUpdate('rentMin', e.target.value)}
                />
                <span className="text-slate-400 text-xs">~</span>
                <input
                  type="number"
                  placeholder="최대"
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={filters.rentMax}
                  onChange={(e) => onUpdate('rentMax', e.target.value)}
                />
              </div>
            </div>

            {/* 권리금 최대 */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                권리금 최대 (만원)
              </label>
              <input
                type="number"
                placeholder="예: 3000"
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={filters.premiumMax}
                onChange={(e) => onUpdate('premiumMax', e.target.value)}
              />
              <p className="text-xs text-slate-400 mt-1">0 입력 시 권리금 없는 매물만</p>
            </div>

            {/* 면적 범위 */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                전용면적 (㎡)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  placeholder="최소"
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={filters.areaMin || ''}
                  onChange={(e) => onUpdate('areaMin', e.target.value)}
                />
                <span className="text-slate-400 text-xs">∼</span>
                <input
                  type="number"
                  placeholder="최대"
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={filters.areaMax || ''}
                  onChange={(e) => onUpdate('areaMax', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, label, activeColor }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer select-none group">
      <div className="relative" onClick={() => onChange(!checked)}>
        <div className={`w-9 h-5 rounded-full transition-colors duration-200 ${checked ? activeColor : 'bg-slate-300'}`} />
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
      <span className="text-sm text-slate-600 group-hover:text-slate-900 transition">{label}</span>
    </label>
  );
}
