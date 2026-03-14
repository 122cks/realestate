import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin } from 'lucide-react';

const fmt = (n) => {
  if (!n && n !== 0) return '-';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}억`;
  return `${n.toLocaleString()}만`;
};

function isKakaoReady() {
  return !!(typeof window !== 'undefined' && window.kakao && window.kakao.maps && window.kakaoSdkReady);
}

/**
 * MapView: 바닐라 kakao.maps API 사용 (react-kakao-maps-sdk 불필요)
 * Props:
 *   properties      - 지도에 표시할 매물 배열
 *   selectedId      - 선택된 매물 ID
 *   onSelectProperty - (prop) => void
 *   routeOrder      - 경로 최적화 결과 배열 (순서대로 연결)
 *   routeMode       - boolean: 경로 선택 모드
 *   routeSelection  - 선택된 매물 ID 배열
 *   onToggleRoute   - (prop) => void
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
  const mapContainerRef = useRef(null);
  const kakaoMapRef = useRef(null);
  const overlaysRef = useRef({}); // id → { overlay, innerDiv }
  const popupOverlayRef = useRef(null);
  const popupContainerRef = useRef(null);
  const routePolylineRef = useRef(null);
  const routeNumbersRef = useRef([]);

  const [kakaoLoaded, setKakaoLoaded] = useState(isKakaoReady());
  const [openPopupId, setOpenPopupId] = useState(null);

  // ─── SDK 로드 감지 ───
  useEffect(() => {
    if (isKakaoReady()) { setKakaoLoaded(true); return; }
    const onReady = () => setKakaoLoaded(true);
    const onErr = () => console.warn('[MapView] Kakao SDK 로드 실패');
    window.addEventListener('kakao-sdk-ready', onReady);
    window.addEventListener('kakao-sdk-error', onErr);
    return () => {
      window.removeEventListener('kakao-sdk-ready', onReady);
      window.removeEventListener('kakao-sdk-error', onErr);
    };
  }, []);

  // ─── 지도 초기화 ───
  useEffect(() => {
    if (!kakaoLoaded || !mapContainerRef.current || kakaoMapRef.current) return;
    const defaultCenter = new window.kakao.maps.LatLng(37.502, 126.722);
    const map = new window.kakao.maps.Map(mapContainerRef.current, {
      center: defaultCenter,
      level: 5,
    });
    kakaoMapRef.current = map;

    // 팝업 컨테이너 생성 (한 번만)
    const popupDiv = document.createElement('div');
    popupContainerRef.current = popupDiv;
    popupOverlayRef.current = new window.kakao.maps.CustomOverlay({
      content: popupDiv,
      yAnchor: 1.55,
      zIndex: 30,
    });

    // 지도 클릭 시 팝업 닫기
    window.kakao.maps.event.addListener(map, 'click', () => setOpenPopupId(null));
  }, [kakaoLoaded]);

  // ─── 마커(CustomOverlay) 생성/갱신 ───
  useEffect(() => {
    const map = kakaoMapRef.current;
    if (!map) return;

    const validProps = properties.filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
    );

    // 기존 오버레이 제거
    Object.values(overlaysRef.current).forEach(({ overlay }) => overlay.setMap(null));
    overlaysRef.current = {};
    setOpenPopupId(null);

    validProps.forEach((prop) => {
      const isSelected = prop.id === selectedId;
      const isRouteSelected = routeSelection.includes(prop.id);
      const routeIdx = routeOrder ? routeOrder.findIndex((r) => r.id === prop.id) : -1;

      const { outer, inner } = buildMarkerDOM(prop, isSelected, isRouteSelected, routeMode, routeIdx);

      outer.addEventListener('click', (e) => {
        e.stopPropagation();
        if (routeMode && onToggleRoute) {
          onToggleRoute(prop);
        } else {
          onSelectProperty(prop);
          setOpenPopupId((prev) => (prev === prop.id ? null : prop.id));
        }
      });

      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(prop.lat, prop.lng),
        content: outer,
        yAnchor: 1.25,
        zIndex: isSelected ? 10 : 1,
      });
      overlay.setMap(map);
      overlaysRef.current[prop.id] = { overlay, inner };
    });

    // 지도 중심 이동
    if (validProps.length > 0) {
      const sel = validProps.find((p) => p.id === selectedId);
      if (sel) {
        map.setCenter(new window.kakao.maps.LatLng(sel.lat, sel.lng));
      } else if (!kakaoMapRef.current._centered) {
        const avgLat = validProps.reduce((s, p) => s + p.lat, 0) / validProps.length;
        const avgLng = validProps.reduce((s, p) => s + p.lng, 0) / validProps.length;
        map.setCenter(new window.kakao.maps.LatLng(avgLat, avgLng));
        kakaoMapRef.current._centered = true;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kakaoLoaded, properties]);

  // ─── 선택 상태 / 경로 선택 반영 (DOM 직접 업데이트) ───
  useEffect(() => {
    Object.entries(overlaysRef.current).forEach(([idStr, { overlay, inner }]) => {
      const id = Number(idStr);
      const prop = properties.find((p) => p.id === id);
      if (!prop || !inner) return;
      applyMarkerStyle(inner, prop, id === selectedId, routeSelection.includes(id), routeMode);
      overlay.setZIndex(id === selectedId ? 10 : 1);
    });
  }, [selectedId, routeSelection, routeMode, properties]);

  // ─── 선택된 매물 중심 이동 ───
  useEffect(() => {
    const map = kakaoMapRef.current;
    if (!map || !selectedId) return;
    const sel = properties.find((p) => p.id === selectedId);
    if (sel && Number.isFinite(sel.lat) && Number.isFinite(sel.lng)) {
      map.panTo(new window.kakao.maps.LatLng(sel.lat, sel.lng));
    }
  }, [selectedId, properties]);

  // ─── 팝업 오버레이 ───
  useEffect(() => {
    const popup = popupOverlayRef.current;
    const container = popupContainerRef.current;
    if (!popup || !container) return;

    if (!openPopupId) {
      popup.setMap(null);
      return;
    }
    const prop = properties.find((p) => p.id === openPopupId);
    if (!prop || !Number.isFinite(prop.lat)) {
      popup.setMap(null);
      return;
    }
    container.innerHTML = buildPopupHTML(prop);
    container.querySelector('[data-action="close"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpenPopupId(null);
    });
    container.querySelector('[data-action="detail"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelectProperty(prop);
      setOpenPopupId(null);
    });
    popup.setPosition(new window.kakao.maps.LatLng(prop.lat, prop.lng));
    popup.setMap(kakaoMapRef.current);
  }, [openPopupId, properties, onSelectProperty]);

  // ─── 경로 폴리라인 ───
  useEffect(() => {
    const map = kakaoMapRef.current;
    if (!map) return;

    // 기존 경로 제거
    if (routePolylineRef.current) { routePolylineRef.current.setMap(null); routePolylineRef.current = null; }
    routeNumbersRef.current.forEach((o) => o.setMap(null));
    routeNumbersRef.current = [];

    if (!routeOrder || routeOrder.length < 2) return;

    const path = routeOrder
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => new window.kakao.maps.LatLng(p.lat, p.lng));

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

    // 번호 레이블
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
  }, [routeOrder]);

  // ─── 렌더링 ───
  if (!kakaoLoaded) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="w-14 h-14 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-slate-700 font-semibold text-base">카카오맵 로딩 중...</p>
          <p className="text-slate-400 text-xs mt-1">앱키: 07dde0a…</p>
          <p className="text-slate-400 text-xs">카카오 개발자 콘솔에서 localhost 허용 도메인 추가 필요</p>
        </div>
        <MapPin className="text-indigo-300" size={32} />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      {/* 경로 모드 안내 배너 */}
      {routeMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg pointer-events-none">
          🗺️ 경로 모드: 지도에서 매물을 클릭해 선택 ({routeSelection.length}/5)
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 마커 DOM 생성
// ─────────────────────────────────────────────
function buildMarkerDOM(prop, isSelected, isRouteSelected, routeMode, routeIdx) {
  const outer = document.createElement('div');
  outer.style.cssText = 'cursor:pointer;user-select:none;';

  const inner = document.createElement('div');
  applyMarkerStyle(inner, prop, isSelected, isRouteSelected, routeMode);

  const tail = document.createElement('div');
  tail.style.cssText = `
    width:8px;height:8px;
    background:${prop.isCompleted ? '#94a3b8' : prop.type === '매매' ? '#dc2626' : '#2563eb'};
    transform:rotate(45deg);
    margin:-4px auto 0;
    border-right:2px solid ${prop.isCompleted ? '#64748b' : prop.type === '매매' ? '#b91c1c' : '#1a56db'};
    border-bottom:2px solid ${prop.isCompleted ? '#64748b' : prop.type === '매매' ? '#b91c1c' : '#1a56db'};
  `;

  outer.appendChild(inner);
  outer.appendChild(tail);
  return { outer, inner };
}

function applyMarkerStyle(inner, prop, isSelected, isRouteSelected, routeMode) {
  const isCompleted = prop.isCompleted;
  const bg = isCompleted ? '#94a3b8' : prop.type === '매매' ? '#dc2626' : '#2563eb';
  const border = isCompleted ? '#64748b' : prop.type === '매매' ? '#b91c1c' : '#1a56db';
  const opacity = isCompleted ? '0.55' : '1';

  let outline = 'none';
  if (isSelected) outline = '2px solid #facc15';
  else if (isRouteSelected) outline = '2px solid #a855f7';
  else if (routeMode && !isCompleted) outline = '1px dashed #a5b4fc';

  const scale = isSelected ? 'scale(1.12)' : isRouteSelected ? 'scale(1.06)' : 'scale(1)';
  const label = (prop.statusOrName || '').length > 8
    ? (prop.statusOrName || '').slice(0, 8) + '…'
    : (prop.statusOrName || '');
  const vacantDot = prop.isVacant && !isCompleted
    ? '<span style="display:inline-block;width:6px;height:6px;background:#4ade80;border-radius:50%;margin-right:3px;vertical-align:middle;"></span>'
    : '';

  inner.style.cssText = `
    padding:3px 8px;
    border-radius:7px;
    border:2px solid ${border};
    background:${bg};
    color:white;
    font-size:11px;
    font-weight:700;
    white-space:nowrap;
    box-shadow:0 2px 8px rgba(0,0,0,0.22);
    opacity:${opacity};
    outline:${outline};
    outline-offset:2px;
    transform:${scale};
    transition:transform 0.15s,outline 0.15s;
    font-family:system-ui,-apple-system,sans-serif;
    line-height:1.4;
  `;
  inner.innerHTML = `${vacantDot}${prop.zone} · ${label}`;
}

// ─────────────────────────────────────────────
// 팝업 HTML (인라인 스타일로 안전하게)
// ─────────────────────────────────────────────
function buildPopupHTML(prop) {
  const bgType = prop.type === '매매' ? '#fef2f2' : '#eff6ff';
  const colorType = prop.type === '매매' ? '#dc2626' : '#2563eb';
  const depositStr = prop.deposit >= 10000
    ? `${(prop.deposit / 10000).toFixed(1)}억` : `${prop.deposit.toLocaleString()}만`;
  const rentStr = prop.rent >= 10000
    ? `${(prop.rent / 10000).toFixed(1)}억` : `${prop.rent.toLocaleString()}만`;
  const premiumStr = prop.premium > 0
    ? (prop.premium >= 10000 ? `${(prop.premium / 10000).toFixed(1)}억` : `${prop.premium.toLocaleString()}만`)
    : '없음';

  return `
    <div style="
      background:white;border-radius:14px;padding:16px;
      box-shadow:0 8px 32px rgba(0,0,0,0.18);
      border:1px solid #e2e8f0;width:240px;position:relative;
      font-family:system-ui,-apple-system,sans-serif;
    " onclick="event.stopPropagation()">
      <button data-action="close" style="
        position:absolute;top:8px;right:8px;
        background:#f1f5f9;border:none;cursor:pointer;
        width:22px;height:22px;border-radius:50%;
        font-size:14px;line-height:1;color:#64748b;
        display:flex;align-items:center;justify-content:center;
      ">×</button>
      <div style="margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
          <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:${bgType};color:${colorType};">${prop.type}</span>
          <span style="font-size:11px;color:#64748b;">${prop.zone}</span>
          ${prop.isVacant ? '<span style="font-size:11px;font-weight:700;padding:2px 6px;border-radius:20px;background:#dcfce7;color:#16a34a;">공실</span>' : ''}
          ${prop.isCompleted ? '<span style="font-size:11px;font-weight:700;padding:2px 6px;border-radius:20px;background:#f1f5f9;color:#64748b;">완료</span>' : ''}
        </div>
        <p style="font-weight:700;font-size:14px;margin:0 0 3px;color:#0f172a;">${prop.statusOrName}</p>
        <p style="font-size:11px;color:#94a3b8;margin:0;">${prop.address || '주소 없음'}</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;background:#f8fafc;border-radius:10px;padding:10px;margin-bottom:10px;">
        <div style="text-align:center;">
          <p style="font-size:10px;color:#94a3b8;margin:0 0 2px;">보증금</p>
          <p style="font-weight:800;font-size:13px;color:#0f172a;margin:0;">${depositStr}</p>
        </div>
        <div style="text-align:center;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
          <p style="font-size:10px;color:#94a3b8;margin:0 0 2px;">월세</p>
          <p style="font-weight:800;font-size:13px;color:#dc2626;margin:0;">${rentStr}</p>
        </div>
        <div style="text-align:center;">
          <p style="font-size:10px;color:#94a3b8;margin:0 0 2px;">권리금</p>
          <p style="font-weight:800;font-size:13px;color:${prop.premium > 0 ? '#d97706' : '#94a3b8'};margin:0;">${premiumStr}</p>
        </div>
      </div>
      <button data-action="detail" style="
        width:100%;padding:8px;background:#2563eb;color:white;
        border:none;border-radius:9px;cursor:pointer;
        font-size:13px;font-weight:600;
        font-family:system-ui,-apple-system,sans-serif;
      ">상세 정보 보기 →</button>
    </div>
  `;
}
