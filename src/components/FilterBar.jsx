import React, { useState } from 'react';
import { Search, SlidersHorizontal, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

export default function FilterBar({ filters, onUpdate, onReset, totalCount, filteredCount, zones }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const zoneOptions = zones && zones.length > 0
    ? ['전체', ...zones.filter(z => z !== '전체')]
    : ['전체'];

  return (
    <div className="bg-white border-b border-slate-200 shadow-sm">
      {/* 메인 검색 바 */}
      <div className="px-4 py-3 flex items-center gap-2">
        {/* 통합 검색 */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="구역, 상호명, 주소, 건물명 검색..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            value={filters.searchTerm}
            onChange={(e) => onUpdate('searchTerm', e.target.value)}
          />
        </div>

        {/* 구역 드롭다운 */}
        <select
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer transition"
          value={filters.zone}
          onChange={(e) => onUpdate('zone', e.target.value)}
        >
          {zoneOptions.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>

        {/* 유형 드롭다운 */}
        <select
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer transition"
          value={filters.type}
          onChange={(e) => onUpdate('type', e.target.value)}
        >
          {['전체', '임대', '매매'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* 상세 필터 토글 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition
            ${isExpanded
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
        >
          <SlidersHorizontal size={16} />
          상세
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* 초기화 버튼 */}
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          title="필터 초기화"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* 빠른 필터 토글 행 */}
      <div className="px-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-wrap">
          {/* 공실만 보기 */}
          <ToggleSwitch
            checked={filters.isVacantOnly}
            onChange={(v) => onUpdate('isVacantOnly', v)}
            label="공실만 보기"
            activeColor="bg-green-500"
          />
          {/* 완료 매물 포함 */}
          <ToggleSwitch
            checked={!!filters.showCompleted}
            onChange={(v) => onUpdate('showCompleted', v)}
            label="완료 포함"
            activeColor="bg-slate-500"
          />
        </div>

        {/* 검색 결과 카운트 */}
        <span className="text-xs text-slate-500">
          총 <span className="font-bold text-blue-600">{filteredCount}</span>개
          {filteredCount !== totalCount && <span className="text-slate-400"> / {totalCount}개</span>}
        </span>
      </div>

      {/* 상세 필터 패널 (접기/펼치기) */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 bg-slate-50">
          <div className="grid grid-cols-3 gap-4">
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
