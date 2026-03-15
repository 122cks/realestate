/**
 * useKakaoMap
 *
 * 카카오맵 인스턴스를 생성·관리하는 커스텀 훅.
 * - 관심사 분리: 지도 비즈니스 로직을 컴포넌트 밖으로 분리
 * - 안전한 라이프사이클: 언마운트 시 이벤트 리스너·DOM 완전 정리
 * - 재사용성: `const { map, popupContainerRef, popupOverlayRef } = useKakaoMap(ref, options)`
 *
 * @param {React.RefObject} mapContainerRef - 지도를 마운트할 DOM ref
 * @param {object}          initialOptions  - LatLng center, level 등 kakao.maps.Map 옵션
 * @returns {{ map: kakao.maps.Map|null, popupContainerRef, popupOverlayRef, fitBounds }}
 */
import { useEffect, useRef, useState } from 'react';

function isKakaoReady() {
  return !!(typeof window !== 'undefined' && window.kakao && window.kakao.maps && window.kakaoSdkReady);
}

export default function useKakaoMap(mapContainerRef, initialOptions = {}) {
  const [map, setMap] = useState(null);
  const [kakaoLoaded, setKakaoLoaded] = useState(isKakaoReady());
  const mapRef = useRef(null);
  const popupContainerRef = useRef(null);
  const popupOverlayRef  = useRef(null);
  const idleTimerRef     = useRef(null);
  const mapBoundsRef     = useRef(null);
  const [boundsVersion, setBoundsVersion] = useState(0);

  // ── SDK 로드 감지 ──────────────────────────────────────────────────
  useEffect(() => {
    if (isKakaoReady()) { setKakaoLoaded(true); return; }
    const onReady = () => setKakaoLoaded(true);
    const onErr   = () => console.warn('[useKakaoMap] Kakao SDK 로드 실패');
    window.addEventListener('kakao-sdk-ready', onReady);
    window.addEventListener('kakao-sdk-error', onErr);
    return () => {
      window.removeEventListener('kakao-sdk-ready', onReady);
      window.removeEventListener('kakao-sdk-error', onErr);
    };
  }, []);

  // ── 지도 초기화 (최초 1회) ────────────────────────────────────────
  useEffect(() => {
    if (!kakaoLoaded || !mapContainerRef.current || mapRef.current) return;

    const defaultCenter = new window.kakao.maps.LatLng(37.502, 126.722);
    const opts = {
      center: defaultCenter,
      level: 5,
      ...initialOptions,
    };

    const mapInstance = new window.kakao.maps.Map(mapContainerRef.current, opts);
    mapRef.current = mapInstance;

    // ZoomControl 추가
    const zoomControl = new window.kakao.maps.ZoomControl();
    mapInstance.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

    // 팝업용 CustomOverlay 컨테이너 (단일 인스턴스, 고정 재사용)
    const popupDiv = document.createElement('div');
    popupContainerRef.current = popupDiv;
    popupOverlayRef.current = new window.kakao.maps.CustomOverlay({
      content: popupDiv,
      yAnchor: 1.55,
      zIndex: 30,
    });

    // idle 이벤트로 뷰포트 경계 추적 (200ms 디바운스)
    const onIdle = () => {
      mapBoundsRef.current = mapInstance.getBounds();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setBoundsVersion(v => v + 1), 200);
    };

    window.kakao.maps.event.addListener(mapInstance, 'idle', onIdle);

    // 초기 bounds
    setTimeout(() => {
      mapBoundsRef.current = mapInstance.getBounds();
      setBoundsVersion(1);
    }, 400);

    setMap(mapInstance);

    // ── 클린업: 컴포넌트 언마운트 시 이벤트 해제 & DOM 정리 ──
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      try { window.kakao.maps.event.removeListener(mapInstance, 'idle', onIdle); } catch { /* noop */ }
      // ZoomControl 제거
      try { mapInstance.removeControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT); } catch { /* noop */ }
      // DOM 비우기 — 지도 객체 및 캔버스 해제
      const container = mapContainerRef.current;
      if (container) {
        container.innerHTML = '';
      }
      mapRef.current = null;
    };
  // initialOptions는 첫 렌더에만 적용 (stable ref)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kakaoLoaded]);

  /**
   * fitBounds: 좌표 배열에 맞게 지도를 자동 확대/축소
   * @param {Array<{lat:number, lng:number}>} points
   */
  const fitBounds = (points) => {
    const m = mapRef.current;
    if (!m || !points?.length) return;
    const bounds = new window.kakao.maps.LatLngBounds();
    points.forEach(p => bounds.extend(new window.kakao.maps.LatLng(p.lat, p.lng)));
    m.setBounds(bounds);
  };

  return {
    map,
    mapRef,
    kakaoLoaded,
    popupContainerRef,
    popupOverlayRef,
    mapBoundsRef,
    boundsVersion,
    fitBounds,
  };
}
