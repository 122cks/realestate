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
    const handler = () => setOpenPopupId(null);
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
    const latPad = (ne.getLat() - sw.getLat()) * 0.15;
    const lngPad = (ne.getLng() - sw.getLng()) * 0.15;
    return valid.filter(p =>
      p.lat >= sw.getLat() - latPad && p.lat <= ne.getLat() + latPad &&
      p.lng >= sw.getLng() - lngPad && p.lng <= ne.getLng() + lngPad
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties, boundsVersion]);

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
          onToggleRoute(prop);
        } else {
          onSelectProperty(prop);
          setOpenPopupId(prev => prev === prop.id ? null : prop.id);
        }
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

  // 팝업 오버레이
  useEffect(() => {
    const popup     = popupOverlayRef.current;
    const container = popupContainerRef.current;
    if (!popup || !container) return;
    if (!openPopupId) { popup.setMap(null); return; }
    const prop = properties.find(p => p.id === openPopupId);
    if (!prop || !Number.isFinite(prop.lat)) { popup.setMap(null); return; }
    container.innerHTML = buildPopupHTML(prop);
    container.querySelector('[data-action="close"]')?.addEventListener('click', e => {
      e.stopPropagation(); setOpenPopupId(null);
    });
    container.querySelector('[data-action="detail"]')?.addEventListener('click', e => {
      e.stopPropagation(); onSelectProperty(prop); setOpenPopupId(null);
    });
    popup.setPosition(new window.kakao.maps.LatLng(prop.lat, prop.lng));
    popup.setMap(map);
  }, [openPopupId, properties, onSelectProperty, map, popupContainerRef, popupOverlayRef]);

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

  const size    = isSelected ? 20 : isRouteSelected ? 16 : isCompleted ? 9 : 13;
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

// ─── 팝업 HTML ─────────────────────────────────────────────────────────
function buildPopupHTML(prop) {
  const bgType    = prop.type==='매매' ? '#fef2f2' : '#eff6ff';
  const colorType = prop.type==='매매' ? '#dc2626' : '#2563eb';
  const fmtM = v => {
    if (!v && v!==0) return '-';
    if (v>=10000) return `${(v/10000).toFixed(1)}억`;
    return `${v.toLocaleString()}만`;
  };
  const tags = [
    prop.isVacant      && '<span style="font-size:10px;font-weight:700;padding:1px 5px;border-radius:20px;background:#dcfce7;color:#16a34a;">공실</span>',
    prop.hasRestaurant && '<span style="font-size:10px;padding:1px 5px;border-radius:20px;background:#fef3c7;color:#d97706;">식당가능</span>',
    prop.parking       && '<span style="font-size:10px;padding:1px 5px;border-radius:20px;background:#e0f2fe;color:#0369a1;">주차</span>',
    prop.hasElevator   && '<span style="font-size:10px;padding:1px 5px;border-radius:20px;background:#f3e8ff;color:#7c3aed;">엘베</span>',
    prop.bathroomType  && `<span style="font-size:10px;padding:1px 5px;border-radius:20px;background:#f1f5f9;color:#475569;">화장실:${prop.bathroomType}</span>`,
  ].filter(Boolean).join('');
  const contactBlock = (prop.contactOwner||prop.contactTenant) ? `
    <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:11px;">
      ${prop.contactOwner  ? `<div>🏠 <b>임대인</b> <a href="tel:${prop.contactOwner.replace(/[^0-9]/g,'')}" style="color:#2563eb;text-decoration:none;">${prop.contactOwner}</a></div>` : ''}
      ${prop.contactTenant ? `<div style="margin-top:2px;">👤 <b>임차인</b> <a href="tel:${prop.contactTenant.replace(/[^0-9]/g,'')}" style="color:#ea580c;text-decoration:none;">${prop.contactTenant}</a></div>` : ''}
    </div>` : '';
  const notesBlock = prop.notes ? `
    <div style="margin-top:8px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:6px 8px;font-size:10px;color:#78350f;line-height:1.4;max-height:60px;overflow-y:auto;">${prop.notes.substring(0,200)}${prop.notes.length>200?'…':''}</div>` : '';
  const floorStr = prop.floor ? `${prop.floor}층${prop.totalFloors?' / 총 '+prop.totalFloors+'층':''}` : '-';
  const areaStr  = prop.areaExclusive > 0 ? `${prop.areaExclusive}㎡` : '-';
  const mgr = prop.manager ? `<div style="margin-top:4px;font-size:10px;color:#6b7280;">담당: ${prop.manager}${prop.confirmedDate?' · '+prop.confirmedDate:''}</div>` : '';
  return `
    <div style="background:white;border-radius:14px;padding:14px;box-shadow:0 8px 32px rgba(0,0,0,0.18);border:1px solid #e2e8f0;width:280px;position:relative;font-family:system-ui,-apple-system,sans-serif;"
      onclick="event.stopPropagation()">
      <button data-action="close" style="position:absolute;top:8px;right:8px;background:#f1f5f9;border:none;cursor:pointer;width:22px;height:22px;border-radius:50%;font-size:14px;color:#64748b;display:flex;align-items:center;justify-content:center;">×</button>
      <div style="margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:5px;margin-bottom:6px;flex-wrap:wrap;">
          <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:${bgType};color:${colorType};">${prop.type}</span>
          <span style="font-size:11px;color:#64748b;">${prop.zone||''}</span>
          ${prop.isCompleted ? '<span style="font-size:10px;font-weight:700;padding:1px 5px;border-radius:20px;background:#f1f5f9;color:#64748b;">완료</span>' : ''}
        </div>
        ${tags ? `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:5px;">${tags}</div>` : ''}
        <p style="font-weight:700;font-size:14px;margin:0 0 2px;color:#0f172a;">${prop.statusOrName||'(업체 정보 없음)'}</p>
        <p style="font-size:11px;color:#94a3b8;margin:0;">${prop.address||'주소 미확인'}${prop.buildingName?' · '+prop.buildingName:''}</p>
        ${prop.approxLocation ? `<p style="font-size:11px;color:#d97706;margin:2px 0 0;">📍 대략적 위치</p>` : ''}
        <p style="font-size:11px;color:#94a3b8;margin:2px 0 0;">${floorStr} · 전용 ${areaStr}</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;background:#f8fafc;border-radius:8px;padding:8px;margin-bottom:8px;">
        <div style="text-align:center;"><p style="font-size:10px;color:#94a3b8;margin:0 0 1px;">보증금</p><p style="font-weight:800;font-size:13px;color:#0f172a;margin:0;">${fmtM(prop.deposit)}</p></div>
        <div style="text-align:center;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;"><p style="font-size:10px;color:#94a3b8;margin:0 0 1px;">월세</p><p style="font-weight:800;font-size:13px;color:#dc2626;margin:0;">${fmtM(prop.rent)}</p></div>
        <div style="text-align:center;"><p style="font-size:10px;color:#94a3b8;margin:0 0 1px;">권리금</p><p style="font-weight:800;font-size:13px;color:${prop.premium>0?'#d97706':'#94a3b8'};margin:0;">${prop.premium>0?fmtM(prop.premium):'없음'}</p></div>
      </div>
      ${prop.maintenanceFee>0 ? `<div style="font-size:10px;color:#6b7280;text-align:right;margin-bottom:6px;">관리비 ${fmtM(prop.maintenanceFee)}/월</div>` : ''}
      ${contactBlock}${notesBlock}${mgr}
      <button data-action="detail" style="width:100%;padding:8px;background:#2563eb;color:white;border:none;border-radius:9px;cursor:pointer;font-size:13px;font-weight:600;margin-top:10px;font-family:system-ui,-apple-system,sans-serif;">상세 정보 보기 →</button>
    </div>`;
}
