/**
 * 최적 경로 계산 유틸리티
 * Nearest Neighbor + 2-opt 알고리즘으로 TSP (외판원 문제) 근사 해법 제공
 * 5개 이하 매물의 최단 방문 경로를 계산합니다.
 */

const EARTH_RADIUS_KM = 6371;

/** 두 좌표 사이 직선 거리 (km, Haversine 공식) */
export function haversine(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 경로 전체 거리 합계 (km) */
export function routeTotalKm(route) {
  let d = 0;
  for (let i = 0; i < route.length - 1; i++) {
    d += haversine(route[i].lat, route[i].lng, route[i + 1].lat, route[i + 1].lng);
  }
  return Math.round(d * 10) / 10;
}

/** Nearest Neighbor 휴리스틱 (첫 번째 점에서 출발) */
function nearestNeighbor(points) {
  const remaining = [...points];
  const route = [remaining.splice(0, 1)[0]];
  while (remaining.length > 0) {
    const last = route[route.length - 1];
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversine(last.lat, last.lng, remaining[i].lat, remaining[i].lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    route.push(remaining.splice(bestIdx, 1)[0]);
  }
  return route;
}

/** 2-opt 개선: 엣지 교환으로 경로 단축 */
function twoOpt(route) {
  let best = [...route];
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ];
        if (routeTotalKm(candidate) < routeTotalKm(best) - 0.001) {
          best = candidate;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }
  return best;
}

/**
 * 최적 경로 계산
 * @param {Array} points - { id, lat, lng, statusOrName, zone, ... } 배열 (최대 10개)
 * @returns {{ route: Array, totalKm: number, skipped: number }}
 *   route: 최적화된 순서의 매물 배열
 *   totalKm: 총 직선 거리 (km)
 *   skipped: 좌표 없어서 제외된 매물 수
 */
export function optimizeRoute(points) {
  const valid = (points || []).filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );
  const skipped = (points || []).length - valid.length;

  if (valid.length === 0) return { route: [], totalKm: 0, skipped };
  if (valid.length === 1) return { route: valid, totalKm: 0, skipped };

  // Nearest Neighbor로 초기 경로
  const nn = nearestNeighbor(valid);
  // 2-opt 개선 (소규모에서만)
  const optimized = valid.length <= 10 ? twoOpt(nn) : nn;

  return {
    route: optimized,
    totalKm: routeTotalKm(optimized),
    skipped,
  };
}

/** 도보 예상 시간 (분, 평균 시속 5km 기준) */
export function walkMinutes(km) {
  return Math.round((km / 5) * 60);
}

/** 자동차 예상 시간 (분, 평균 시속 30km 기준 - 도심) */
export function driveMinutes(km) {
  return Math.round((km / 30) * 60);
}
