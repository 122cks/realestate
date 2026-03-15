import React, { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import MapView from './components/MapView';
import FilterBar from './components/FilterBar';
import PropertyList from './components/PropertyList';
import PropertyDrawer from './components/PropertyDrawer';
import RoutePanel from './components/RoutePanel';
import PropertyEditModal from './components/PropertyEditModal';
import { useProperties } from './hooks/useProperties';
import { Building2, RefreshCw, Route, X, BarChart2, MapIcon, LayoutList } from 'lucide-react';

// 통계 패널은 사용할 때만 로드 (Recharts가 크므로 코드 분할)
const StatsPanel = lazy(() => import('./components/StatsPanel'));

function StatBadge({ label, value, color }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-lg font-bold ${color}`}>{value}</span>
      <span className="text-slate-400 text-xs">{label}</span>
    </div>
  );
}

function App() {
  const {
    filteredProperties,
    properties,
    loading,
    error,
    filters,
    zones,
    managers,
    updateFilter,
    resetFilters,
    connectGoogle,
    disconnectGoogle,
    googleUser,
    googleToken,
    sheetMeta,
    geocoding,
    updateProperty,
    completeProperty,
    uncompleteProperty,
    routeSelection,
    toggleRouteSelection,
    clearRouteSelection,
    routeResult,
  } = useProperties();

  const [selectedProperty, setSelectedProperty] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [routeMode, setRouteMode] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [isStatsPanelOpen, setIsStatsPanelOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState('list'); // 'map' | 'list'
  const [mapVisibleIds, setMapVisibleIds] = useState(null); // Set<id> | null

  // 모바일 하단 시트 드래그
  const SNAP_COLLAPSED = 60;
  const sheetRef = useRef(null);
  const dragStartRef = useRef(null);
  const [sheetHeight, setSheetHeight] = useState('45vh');
  const [isDragging, setIsDragging] = useState(false);

  function snapToHeight(pxHeight) {
    const winH = window.innerHeight;
    const snaps = [SNAP_COLLAPSED, winH * 0.45, winH * 0.82];
    const closest = snaps.reduce((prev, curr) => Math.abs(curr - pxHeight) < Math.abs(prev - pxHeight) ? curr : prev);
    if (closest <= SNAP_COLLAPSED) return `${SNAP_COLLAPSED}px`;
    if (closest <= winH * 0.55) return '45vh';
    return '82vh';
  }

  const onSheetTouchStart = useCallback((e) => {
    const rect = sheetRef.current?.getBoundingClientRect();
    dragStartRef.current = { y: e.touches[0].clientY, height: rect ? rect.height : 300 };
    setIsDragging(true);
  }, []);

  const onSheetTouchMove = useCallback((e) => {
    if (!dragStartRef.current) return;
    const dy = dragStartRef.current.y - e.touches[0].clientY;
    const newH = Math.max(SNAP_COLLAPSED, Math.min(window.innerHeight * 0.82, dragStartRef.current.height + dy));
    setSheetHeight(`${newH}px`);
  }, []);

  const onSheetTouchEnd = useCallback(() => {
    if (!dragStartRef.current || !sheetRef.current) { setIsDragging(false); return; }
    setSheetHeight(snapToHeight(sheetRef.current.getBoundingClientRect().height));
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  // 모바일 탭 → 시트 높이 연동
  useEffect(() => {
    if (mobileTab === 'map') setSheetHeight(`${SNAP_COLLAPSED}px`);
    else if (mobileTab === 'list') setSheetHeight('45vh');
  }, [mobileTab]);

  // 완료처리 후에도 드로어가 최신 상태를 보여주도록 properties 배열에서 re-derive
  const currentSelectedProperty = selectedProperty
    ? (properties.find(p => p.id === selectedProperty.id) || selectedProperty)
    : null;
  const handleBoundsChange = useCallback((ids) => setMapVisibleIds(ids), []);
  const viewportProps = mapVisibleIds
    ? filteredProperties.filter(p => mapVisibleIds.has(p.id))
    : filteredProperties;

  // Esc 키로 drawer/modal 닫기
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setIsDrawerOpen(false);
        setEditingProperty(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // CSV 내보내기
  const handleExportCSV = useCallback(() => {
    const headers = ['순번', '구역', '상호명', '주소', '건물명', '층', '호', '전용면적', '보증금', '월세', '권리금', '관리비', '공실', '임대인', '임차인연락처', '담당', '비고'];
    const rows = filteredProperties.map(p => [
      p.id, p.zone, p.statusOrName, p.address, p.buildingName,
      p.floor, p.unit, p.areaExclusive, p.deposit, p.rent,
      p.premium, p.maintenanceFee, p.isVacant ? '공실' : '',
      p.contactOwner, p.contactTenant, p.manager, p.notes,
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `매물목록_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredProperties]);

  const handleSelectProperty = useCallback((prop) => {
    setSelectedProperty(prop);
    setIsDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const handleToggleRouteMode = useCallback(() => {
    setRouteMode((v) => {
      if (v) clearRouteSelection();
      return !v;
    });
  }, [clearRouteSelection]);

  const handleEditProperty = useCallback((prop) => {
    setEditingProperty(prop);
    setIsDrawerOpen(false);
  }, []);

  const handleSaveEdit = useCallback(async (id, patch) => {
    await updateProperty(id, patch);
    setEditingProperty(null);
  }, [updateProperty]);

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 overflow-hidden">

      {/* 글로벌 헤더 */}
      <header className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white flex-shrink-0 shadow-lg z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Building2 size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">부동산 매물 관리</h1>
            <p className="text-xs text-slate-400 leading-tight">상가 임대 · 매매 현황</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 통계 배지 */}
          <div className="hidden sm:flex items-center gap-4 text-sm">
            <StatBadge label="전체" value={properties.length} color="text-slate-300" />
            <StatBadge label="공실" value={properties.filter((p) => p.isVacant && !p.isCompleted).length} color="text-green-400" />
            <StatBadge label="임대" value={properties.filter((p) => p.type === '임대' && !p.isCompleted).length} color="text-blue-400" />
            <StatBadge label="매매" value={properties.filter((p) => p.type === '매매' && !p.isCompleted).length} color="text-rose-400" />
          </div>

          {/* 통계 대시보드 버튼 */}
          <button
            onClick={() => setIsStatsPanelOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg transition border bg-white/10 border-white/20 text-white hover:bg-white/20"
            title="통계 대시보드"
          >
            <BarChart2 size={15} />
            통계
          </button>

          {/* 경로 최적화 모드 토글 */}
          <button
            onClick={handleToggleRouteMode}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg transition border
              ${routeMode
                ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/30'
                : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
              }`}
          >
            <Route size={15} />
            <span className="hidden lg:inline">경로 최적화</span>
            {routeMode && routeSelection.length > 0 && (
              <span className="ml-1 bg-white/30 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {routeSelection.length}
              </span>
            )}
          </button>

          {/* 지오코딩 진행 표시 (bar + 텍스트) */}
          {geocoding.running && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20 min-w-[130px]">
              <RefreshCw size={12} className="animate-spin flex-shrink-0" />
              <div className="flex-1">
                <div className="mb-0.5">좌표 변환 {geocoding.done}/{geocoding.total}</div>
                <div className="w-full bg-amber-900/40 rounded-full h-1">
                  <div
                    className="bg-amber-400 h-1 rounded-full transition-all duration-300"
                    style={{ width: `${geocoding.total > 0 ? Math.round((geocoding.done / geocoding.total) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Google 연동 버튼 */}
          {googleUser ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  G
                </div>
                <span className="text-xs text-slate-200 max-w-24 truncate hidden lg:block">{googleUser.email}</span>
              </div>
              <button
                onClick={disconnectGoogle}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs border border-white/20 transition"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <button
              onClick={async () => { try { await connectGoogle(); } catch (e) {} }}
              className="px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-100 rounded-lg text-sm font-semibold transition"
            >
              구글 연동
            </button>
          )}
        </div>
      </header>

      {/* 경로 모드 배너 */}
      {routeMode && (
        <div className="bg-purple-700 text-white px-5 py-2 flex items-center justify-between text-sm flex-shrink-0 z-20">
          <span className="flex items-center gap-2">
            <Route size={15} />
            <strong>경로 최적화 모드</strong>
            <span className="text-purple-200">— 지도 또는 목록에서 매물을 선택하세요</span>
          </span>
          <button
            onClick={handleToggleRouteMode}
            className="p-1 rounded-full hover:bg-purple-600 transition"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <main className="flex flex-1 overflow-hidden flex-col md:flex-row pb-0">

        {/* 좌측: 카카오맵 */}
        <section className="flex md:flex flex-col md:w-3/5 w-full md:h-full h-full flex-shrink-0 relative md:border-r border-slate-300">
          {loading ? (
            <div className="flex-1 flex items-center justify-center bg-slate-100">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-500 text-sm">데이터를 불러오는 중...</p>
              </div>
            </div>
          ) : (
            <MapView
              properties={properties}
              selectedId={selectedProperty?.id}
              onSelectProperty={handleSelectProperty}
              onBoundsChange={handleBoundsChange}
              routeOrder={routeResult?.route}
              routeMode={routeMode}
              routeSelection={routeSelection}
              onToggleRoute={toggleRouteSelection}
            />
          )}

          {/* 범례 */}
          {!loading && (
            <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-3 py-2 text-xs border border-slate-200 z-10">
              <p className="font-semibold text-slate-600 mb-1.5">범례</p>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-600 rounded-full" /><span className="text-slate-600">임대</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-rose-600 rounded-full" /><span className="text-slate-600">매매</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded-full" /><span className="text-slate-600">공실</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-slate-500 rounded-full" /><span className="text-slate-600">완료</span></div>
                {routeMode && <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-purple-500 rounded-full" /><span className="text-slate-600">경로 선택</span></div>}
              </div>
            </div>
          )}

          {/* 경로 패널 (지도 하단에 오버레이) */}
          {routeMode && (
            <div className="absolute bottom-0 left-0 right-0 z-20 max-h-72 overflow-y-auto">
              <RoutePanel
                properties={properties}
                routeSelection={routeSelection}
                routeResult={routeResult}
                onToggleRoute={toggleRouteSelection}
                onClear={clearRouteSelection}
                onClose={handleToggleRouteMode}
              />
            </div>
          )}
        </section>

        {/* 우측: 필터 + 매물 리스트 (Desktop only) */}
        <section className="hidden md:flex flex-col md:w-2/5 h-full overflow-hidden bg-white" aria-label="매물 목록 영역">
          <FilterBar
            filters={filters}
            onUpdate={updateFilter}
            onReset={resetFilters}
            totalCount={properties.filter(p => !p.isCompleted).length}
            filteredCount={filteredProperties.length}
            zones={zones}
            managers={managers}
            onExportCSV={handleExportCSV}
          />
          <div className="flex-1 overflow-hidden flex flex-col">
            {mapVisibleIds && mapVisibleIds.size > 0 && (
              <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-200 flex items-center justify-between text-xs flex-shrink-0">
                <span className="text-blue-700 font-semibold">🗺️ 지도 영역 내 <b>{viewportProps.length}</b>건 표시</span>
                <button onClick={() => setMapVisibleIds(null)} className="text-blue-500 hover:text-blue-700 underline">전체 보기</button>
              </div>
            )}
            <PropertyList
              properties={viewportProps}
              selectedId={selectedProperty?.id}
              onSelectProperty={handleSelectProperty}
              routeMode={routeMode}
              routeSelection={routeSelection}
              onToggleRoute={toggleRouteSelection}
            />
          </div>
        </section>
      </main>

      {/* ─── 모바일 하단 시트 (md 미만에서만 표시) ─── */}
      <div
        ref={sheetRef}
        className="md:hidden fixed left-0 right-0 z-30 bg-white rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          bottom: '56px', /* 하단 nav 높이만큼 */
          height: sheetHeight,
          transition: isDragging ? 'none' : 'height 0.3s ease-out',
        }}
      >
        {/* 드래그 핸들 */}
        <div
          className="flex-shrink-0 pt-2 pb-1 flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing touch-none select-none"
          onTouchStart={onSheetTouchStart}
          onTouchMove={onSheetTouchMove}
          onTouchEnd={onSheetTouchEnd}
        >
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
          <span className="text-xs text-slate-500 font-medium">
            {filteredProperties.length}건 | {viewportProps.length !== filteredProperties.length ? `지도 내 ${viewportProps.length}건` : '전체 목록'}
          </span>
        </div>

        {/* 모바일 FilterBar + PropertyList */}
        <FilterBar
          filters={filters}
          onUpdate={updateFilter}
          onReset={resetFilters}
          totalCount={properties.filter(p => !p.isCompleted).length}
          filteredCount={filteredProperties.length}
          zones={zones}
          managers={managers}
          onExportCSV={handleExportCSV}
        />
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {mapVisibleIds && mapVisibleIds.size > 0 && (
            <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-200 flex items-center justify-between text-xs flex-shrink-0">
              <span className="text-blue-700 font-semibold">🗺️ 지도 영역 내 <b>{viewportProps.length}</b>건</span>
              <button onClick={() => setMapVisibleIds(null)} className="text-blue-500 hover:text-blue-700 underline">전체 보기</button>
            </div>
          )}
          <PropertyList
            properties={viewportProps}
            selectedId={selectedProperty?.id}
            onSelectProperty={(prop) => { handleSelectProperty(prop); setSheetHeight('45vh'); }}
            routeMode={routeMode}
            routeSelection={routeSelection}
            onToggleRoute={toggleRouteSelection}
          />
        </div>
      </div>

      {/* 상세 정보 드로어 */}
      {isDrawerOpen && currentSelectedProperty && (
        <PropertyDrawer
          property={currentSelectedProperty}
          onClose={handleCloseDrawer}
          onEdit={handleEditProperty}
          onComplete={completeProperty}
          onUncomplete={uncompleteProperty}
        />
      )}

      {/* 통계 패널 */}
      {isStatsPanelOpen && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center"><div className="bg-white rounded-xl px-6 py-4 text-sm text-slate-600">통계 로딩 중...</div></div>}>
          <StatsPanel
            properties={properties}
            onClose={() => setIsStatsPanelOpen(false)}
          />
        </Suspense>
      )}

      {/* 수정 모달 */}
      {editingProperty && (
        <PropertyEditModal
          property={editingProperty}
          onSave={handleSaveEdit}
          onClose={() => setEditingProperty(null)}
          sheetMeta={sheetMeta}
          googleToken={googleToken}
        />
      )}

      {/* 모바일 하단 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-slate-200 shadow-lg z-40 flex safe-area-bottom">
        <button
          onClick={() => setMobileTab('map')}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition
            ${mobileTab === 'map' ? 'text-blue-600' : 'text-slate-500'}`}
        >
          <MapIcon size={20} />
          지도
        </button>
        <button
          onClick={() => setMobileTab('list')}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition
            ${mobileTab === 'list' ? 'text-blue-600' : 'text-slate-500'}`}
        >
          <LayoutList size={20} />
          목록
        </button>
        <button
          onClick={() => setIsStatsPanelOpen(true)}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium text-slate-500 hover:text-blue-600 transition"
        >
          <BarChart2 size={20} />
          통계
        </button>
        <button
          onClick={handleToggleRouteMode}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition
            ${routeMode ? 'text-purple-600' : 'text-slate-500 hover:text-purple-600'}`}
        >
          <Route size={20} />
          경로{routeMode && routeSelection.length > 0 ? ` (${routeSelection.length})` : ''}
        </button>
      </nav>
    </div>
  );
}

export default App;
