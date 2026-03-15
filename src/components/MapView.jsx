import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { MapPin, Maximize2 } from 'lucide-react';
import useKakaoMap from '../hooks/useKakaoMap';

/**
 * MapView — useKakaoMap 훅 기반 리팩토링
 * 클러스터링 완전 제거: 모든 매물을 개별 점(dot) 마커로 표시
 */
export default function MapView({
  properties = [],
  selectedId,
  onSelectProperty,
  onBoundsChange,
  routeOrder,
  routeMode = false,
  routeSelection = [],
  onToggleRoute,
}) {
  const mapContainerRef  = useRef(null);
  const overlaysRef      = useRef({});
  const routePolylineRef = useRef(null);
  const routeNumbersRef  = useRef([]);
  const propsRef         = useRef(properties);
  useEffect(() => { propsRef.current = properties; }, [properties]);

  const [openPopupId, setOpenPopupId] = useState(null);
  const [hoverPopupId, setHoverPopupId] = useState(null);

  const {
    map,
    mapRef: kakaoMapRef,
    kakaoLoaded,
    popupContainerRef,
    popupOverlayRef,
    mapBoundsRef,
    boundsVersion,
    fitBounds,
  } = useKakaoMap(mapContainerRef);

  // 지도 클릭 → 팝업 닫기
  useEffect(() => {
    if (!map) return;
    const handler = () => { setOpenPopupId(null); };
    window.kakao.maps.event.addListener(map, 'click', handler);
    return () => { try { window.kakao.maps.event.removeListener(map, 'click', handler); } catch { /**/ } };
  }, [map]);

  const fitAllMarkers = useCallback(() => {
    const valid = (propsRef.current || []).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    fitBounds(valid);
  }, [fitBounds]);

  // 뷰포트 내 유효 매물 (15% 패딩)
  const visibleProps = useMemo(() => {
    const valid = (properties || []).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    const bounds = mapBoundsRef.current;
    if (!bounds) return valid;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    // 패딩을 줄여 뷰포트 기준을 더 엄격하게 함 (5% 패딩)
    const latPad = (ne.getLat() - sw.getLat()) * 0.05;
    const lngPad = (ne.getLng() - sw.getLng()) * 0.05;
    return valid.filter(p =>
      p.lat >= sw.getLat() - latPad && p.lat <= ne.getLat() + latPad &&
      p.lng >= sw.getLng() - lngPad && p.lng <= ne.getLng() + lngPad
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties, boundsVersion]);

  // 뷰포트 변경 시 부모에 ID 세트 전달
  const onBoundsChangeRef = useRef(onBoundsChange);
  useEffect(() => { onBoundsChangeRef.current = onBoundsChange; }, [onBoundsChange]);
  useEffect(() => {
    if (onBoundsChangeRef.current) {
      try {
        const ids = new Set(visibleProps.map(p => p.id));
        const center = map ? map.getCenter() : null;
        const centerCoords = center ? { lat: center.getLat(), lng: center.getLng() } : null;
        onBoundsChangeRef.current({ ids, center: centerCoords });
      } catch {
        onBoundsChangeRef.current(new Set(visibleProps.map(p => p.id)));
      }
    }
  }, [visibleProps, map]);

  // 개별 마커 생성/제거 (클러스터링 없음 — 모든 매물 점으로 표시)
  useEffect(() => {
    if (!map) return;

    if (!visibleProps || visibleProps.length === 0) {
      for (const k of Object.keys(overlaysRef.current)) {
        try { overlaysRef.current[k].overlay.setMap(null); } catch { /**/ }
        delete overlaysRef.current[k];
      }
      return;
    }

    const desiredIds  = new Set(visibleProps.map(p => String(p.id)));
    const existingIds = new Set(Object.keys(overlaysRef.current));

    // 뷰포트 밖 마커 제거
    for (const k of existingIds) {
      if (!desiredIds.has(k)) {
        try { overlaysRef.current[k].overlay.setMap(null); } catch { /**/ }
        delete overlaysRef.current[k];
      }
    }

    // 새 마커 추가
    for (const prop of visibleProps) {
      const key = String(prop.id);
      if (existingIds.has(key)) continue;

      const isSelected      = prop.id === selectedId;
      const isRouteSelected = routeSelection.includes(prop.id);
      const routeIdx        = routeOrder ? routeOrder.findIndex(r => r.id === prop.id) : -1;
      const { outer, inner } = buildMarkerDOM(prop, isSelected, isRouteSelected, routeMode, routeIdx);

      outer.addEventListener('click', (e) => {
        e.stopPropagation();
        if (routeMode && onToggleRoute) {
          onToggleRoute(prop.id);
        } else {
          setOpenPopupId(prev => prev === prop.id ? null : prop.id);
          setHoverPopupId(null);
        }
      });

      // 호버 팝업 (데스크톱)
      let hoverTimer;
      outer.addEventListener('mouseenter', () => {
        if (!routeMode) {
          clearTimeout(hoverTimer);
          hoverTimer = setTimeout(() => setHoverPopupId(prop.id), 200);
        }
      });
      outer.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimer);
        setHoverPopupId(prev => prev === prop.id ? null : prev);
      });

      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(prop.lat, prop.lng),
        content: outer,
        yAnchor: 1.25,
        zIndex: isSelected ? 10 : 1,
      });
      overlay.setMap(map);
      overlaysRef.current[key] = { overlay, inner, propId: prop.id };
    }

    // 첫 로드 중심 설정 (1회)
    if (visibleProps.length > 0 && !kakaoMapRef.current?._centered) {
      const sel = visibleProps.find(p => p.id === selectedId);
      if (sel) {
        map.setCenter(new window.kakao.maps.LatLng(sel.lat, sel.lng));
      } else {
        const avgLat = visibleProps.reduce((s, p) => s + p.lat, 0) / visibleProps.length;
        const avgLng = visibleProps.reduce((s, p) => s + p.lng, 0) / visibleProps.length;
        map.setCenter(new window.kakao.maps.LatLng(avgLat, avgLng));
      }
      if (kakaoMapRef.current) kakaoMapRef.current._centered = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, visibleProps, selectedId, routeSelection, routeOrder]);

  // 선택·경로 상태 DOM 직접 업데이트
  useEffect(() => {
    Object.values(overlaysRef.current).forEach(entry => {
      const { overlay, inner, propId } = entry || {};
      if (!inner || !overlay) return;
      const prop = properties.find(p => p.id === propId);
      if (!prop) return;
      const isRouteSelected = routeSelection.includes(prop.id);
      const routeIdx = routeOrder ? routeOrder.findIndex(r => r.id === prop.id) : -1;
      applyMarkerStyle(inner, prop, prop.id === selectedId, isRouteSelected, routeMode, routeIdx);
      try { overlay.setZIndex(prop.id === selectedId ? 10 : 1); } catch { /**/ }
    });
  }, [selectedId, routeSelection, routeMode, properties, routeOrder]);

  // 선택 매물 중심 이동
  useEffect(() => {
    if (!map || !selectedId) return;
    const sel = properties.find(p => p.id === selectedId);
    if (sel && Number.isFinite(sel.lat) && Number.isFinite(sel.lng)) {
      map.panTo(new window.kakao.maps.LatLng(sel.lat, sel.lng));
    }
  }, [selectedId, properties, map]);

  // 팝업 오버레이 — 마커 클릭 → 썸네일 → 상세정보보기 클릭 → 바로 드로어 열기
  useEffect(() => {
    const popup     = popupOverlayRef.current;
    const container = popupContainerRef.current;
    if (!popup || !container) return;
    const activeId = openPopupId || hoverPopupId;
    if (!activeId) { popup.setMap(null); return; }
    const prop = properties.find(p => p.id === activeId);
    if (!prop || !Number.isFinite(prop.lat)) { popup.setMap(null); return; }
    container.innerHTML = buildThumbnailHTML(prop);
    container.querySelector('[data-action="close"]')?.addEventListener('click', e => {
      e.stopPropagation(); setOpenPopupId(null); setHoverPopupId(null);
    });
    const detailBtn = container.querySelector('[data-action="detail"]');
    detailBtn?.addEventListener('click', e => {
      e.stopPropagation();
      onSelectProperty(prop);
      setOpenPopupId(null);
      setHoverPopupId(null);
    });
    popup.setPosition(new window.kakao.maps.LatLng(prop.lat, prop.lng));
    popup.setMap(map);
  }, [openPopupId, hoverPopupId, properties, onSelectProperty, map, popupContainerRef, popupOverlayRef]);

  // 경로 폴리라인
  useEffect(() => {
    if (!map) return;
    if (routePolylineRef.current) { routePolylineRef.current.setMap(null); routePolylineRef.current = null; }
    routeNumbersRef.current.forEach(o => o.setMap(null));
    routeNumbersRef.current = [];
    if (!routeOrder || routeOrder.length < 2) return;

    const path = routeOrder
      .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map(p => new window.kakao.maps.LatLng(p.lat, p.lng));
    if (path.length < 2) return;

    const polyline = new window.kakao.maps.Polyline({
      path,
      strokeWeight: 4,
      strokeColor: '#6366f1',
      strokeOpacity: 0.85,
      strokeStyle: 'solid',
    });
    polyline.setMap(map);
    routePolylineRef.current = polyline;

    routeOrder.forEach((prop, idx) => {
      if (!Number.isFinite(prop.lat)) return;
      const div = document.createElement('div');
      div.style.cssText = `
        width:22px;height:22px;border-radius:50%;
        background:#6366f1;color:white;border:2px solid white;
        display:flex;align-items:center;justify-content:center;
        font-size:11px;font-weight:700;
        box-shadow:0 2px 6px rgba(0,0,0,0.35);
        font-family:system-ui,-apple-system,sans-serif;
      `;
      div.textContent = String(idx + 1);
      const numOverlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(prop.lat, prop.lng),
        content: div,
        zIndex: 20,
        yAnchor: 2.8,
      });
      numOverlay.setMap(map);
      routeNumbersRef.current.push(numOverlay);
    });
  }, [routeOrder, map]);

  // ─── 렌더링 ─────────────────────────────────────────────────────
  if (!kakaoLoaded) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="w-14 h-14 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-slate-700 font-semibold text-base">카카오맵 로딩 중...</p>
          <p className="text-slate-400 text-xs mt-1">카카오 개발자 콘솔에서 허용 도메인 설정 필요</p>
        </div>
        <MapPin className="text-indigo-300" size={32} />
      </div>
    );
  }

  const validCount   = (properties || []).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)).length;
  const visibleCount = visibleProps.length;

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      <button
        onClick={fitAllMarkers}
        className="absolute bottom-20 right-3 z-10 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold shadow-md hover:bg-slate-50 active:scale-95 transition flex items-center gap-1.5"
        title="모든 유효 좌표 매물을 화면에 맞춤"
      >
        <Maximize2 size={13} /> 전체 보기
      </button>

      <div className="absolute bottom-20 left-24 z-10 bg-white/90 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs shadow pointer-events-none">
        <span className="font-bold text-blue-600">{visibleCount}</span>
        <span className="text-slate-500"> / {validCount}개 표시</span>
      </div>

      {routeMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg pointer-events-none">
          🗺️ 경로 모드: 지도에서 매물을 클릭해 선택 ({routeSelection.length}개 선택)
        </div>
      )}
    </div>
  );
}

function buildThumbnailHTML(prop) {
  const fmtM = v => {
    if (!v && v !== 0) return '-';
    if (v >= 10000) return `${(v/10000).toFixed(1)}억`;
    return `${v.toLocaleString()}만`;
  };
  const toPyeong = m2 => m2 > 0 ? `${(m2 / 3.30579).toFixed(1)}평` : null;

  const typeLabel = prop.isCompleted ? '완료' : prop.isVacant ? '공실' : (prop.type || '임대');
  const headerBg = prop.isCompleted ? '#94a3b8'
    : prop.isVacant ? '#16a34a'
    : prop.type === '매매' ? '#dc2626'
    : '#2563eb';

  const priceStr = prop.isCompleted ? '완료'
    : prop.type === '매매'
    ? `매매 ${fmtM(prop.deposit)}`
    : `${fmtM(prop.deposit)} / ${fmtM(prop.rent)}만`;

  const py = toPyeong(prop.areaExclusive);
  const areaStr = prop.areaExclusive > 0 ? `${prop.areaExclusive}㎡${py ? ` (${py})` : ''}` : '';
  const floorStr = prop.floor ? `${prop.floor}층${prop.totalFloors ? '/' + prop.totalFloors + '층' : ''}` : '';
  const infoStr = [areaStr, floorStr].filter(Boolean).join(' · ');

  const tagItems = [
    prop.parking && '주차',
    prop.hasElevator && '엘베',
    prop.hasRestaurant && '식당가능',
    prop.approxLocation && '📍대략위치',
  ].filter(Boolean);
  const tags = tagItems.map(t => `<span style="font-size:10px;padding:1px 6px;border-radius:20px;background:#f1f5f9;color:#475569;">${t}</span>`).join('');

  return `
    <div style="background:white;border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,0.16);width:252px;position:relative;font-family:system-ui,-apple-system,sans-serif;" onclick="event.stopPropagation()">
      <div style="background:${headerBg};padding:10px 14px;padding-right:32px;">
        <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px;">
          <span style="font-size:10px;font-weight:700;background:rgba(255,255,255,0.25);color:white;padding:1px 7px;border-radius:20px;">${typeLabel}</span>
          ${prop.zone ? `<span style="font-size:10px;color:rgba(255,255,255,0.8);">${prop.zone}</span>` : ''}
        </div>
        <div style="color:white;font-size:17px;font-weight:800;line-height:1.2;">${priceStr}</div>
      </div>
      <button data-action="close" style="position:absolute;top:8px;right:10px;background:rgba(255,255,255,0.22);border:none;border-radius:50%;width:22px;height:22px;font-size:15px;color:white;cursor:pointer;line-height:1;">×</button>
      <div style="padding:10px 14px 0;">
        <p style="font-weight:700;font-size:13px;color:#0f172a;margin:0 0 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${prop.statusOrName || '(업체 정보 없음)'}</p>
        ${infoStr ? `<p style="font-size:11px;color:#64748b;margin:0 0 2px;">${infoStr}</p>` : ''}
        ${prop.address ? `<p style="font-size:10px;color:#94a3b8;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">📍 ${prop.address}</p>` : ''}
        ${tags ? `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:6px;">${tags}</div>` : ''}
        ${prop.notes ? `<p style="font-size:10px;color:#78350f;background:#fffbeb;padding:4px 7px;border-radius:5px;margin:6px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${prop.notes.substring(0, 60)}${prop.notes.length > 60 ? '…' : ''}</p>` : ''}
        ${prop.maintenanceFee > 0 ? `<p style="font-size:10px;color:#6b7280;margin:4px 0 0;">관리비 ${fmtM(prop.maintenanceFee)}/월</p>` : ''}
        ${prop.confirmedDate ? `<p style="font-size:10px;color:#9ca3af;margin:3px 0 0;">확인매물 ${prop.confirmedDate}${prop.manager ? ' · ' + prop.manager : ''}</p>` : ''}
      </div>
      <button data-action="detail" style="display:block;width:100%;padding:11px;background:#2563eb;color:white;border:none;cursor:pointer;font-size:13px;font-weight:700;margin-top:10px;letter-spacing:0.01em;font-family:system-ui,-apple-system,sans-serif;">상세 정보 보기 →</button>
    </div>
  `;
}

// ─── 마커 DOM ──────────────────────────────────────────────────────────
function buildMarkerDOM(prop, isSelected, isRouteSelected, routeMode, routeIdx) {
  const outer = document.createElement('div');
  outer.style.cssText = 'cursor:pointer;user-select:none;position:relative;display:inline-flex;align-items:center;justify-content:center;pointer-events:auto;';
  const inner = document.createElement('div');
  applyMarkerStyle(inner, prop, isSelected, isRouteSelected, routeMode, routeIdx);
  outer.appendChild(inner);

  // 임장 메모 표시 배지
  try {
    const hasMemo = !!(localStorage.getItem(`re_memo_${prop.id}`));
    if (hasMemo) {
      const badge = document.createElement('div');
      badge.style.cssText = 'position:absolute;top:-4px;right:-4px;width:8px;height:8px;border-radius:50%;background:#f59e0b;border:1.5px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);pointer-events:none;';
      outer.appendChild(badge);
    }
  } catch { /**/ }

  try {
    const dep = Number.isFinite(prop.deposit) ? (prop.deposit >= 10000 ? `${(prop.deposit/10000).toFixed(1)}억` : `${prop.deposit.toLocaleString()}만`) : '-';
    const ren = Number.isFinite(prop.rent)    ? (prop.rent    >= 10000 ? `${(prop.rent/10000).toFixed(1)}억`    : `${prop.rent.toLocaleString()}만`)    : '-';
    outer.title = `${prop.statusOrName||''} • ${prop.address||''}${prop.approxLocation?' (대략 위치)':''}\n보증금: ${dep}  월세: ${ren}`;
  } catch { /**/ }
  return { outer, inner };
}

function applyMarkerStyle(inner, prop, isSelected, isRouteSelected, routeMode, routeIdx) {
  const isCompleted = prop.isCompleted;
  let bg, border, shadow;
  if (isCompleted)              { bg='#cbd5e1'; border='#94a3b8'; shadow='rgba(100,116,139,0.25)'; }
  else if (prop.isVacant)       { bg='#22c55e'; border='#16a34a'; shadow='rgba(34,197,94,0.40)'; }
  else if (prop.type==='매매')  { bg='#f87171'; border='#dc2626'; shadow='rgba(239,68,68,0.40)'; }
  else                          { bg='#60a5fa'; border='#2563eb'; shadow='rgba(59,130,246,0.40)'; }

  const size    = isSelected ? 14 : isRouteSelected ? 11 : isCompleted ? 6 : 9;
  const scale   = isSelected ? 1.2 : isRouteSelected ? 1.05 : 1;
  const opacity = prop.approxLocation && !isCompleted ? 0.55 : isCompleted ? 0.65 : 1;

  let outline = 'none';
  if (isSelected)                             outline = '3px solid #facc15';
  else if (isRouteSelected && routeIdx >= 0)  outline = '3px solid #a855f7';
  else if (routeMode && !isCompleted)         outline = '1.5px dashed #818cf8';

  const innerDot = (!isCompleted && prop.isVacant && !isSelected)
    ? `<div style="width:5px;height:5px;border-radius:50%;background:white;opacity:0.85;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);"></div>`
    : '';

  inner.style.cssText = `
    width:${size}px;height:${size}px;border-radius:50%;
    background:${bg};border:2px solid ${border};
    box-shadow:0 2px 8px ${shadow};
    transform:scale(${scale});
    transition:transform 0.12s,box-shadow 0.12s;
    opacity:${opacity};
    outline:${outline};outline-offset:2px;
    position:relative;
  `;
  inner.innerHTML = innerDot;
}
