import { metresBetween } from "@/lib/location/geometry";
import type { Coord, HeritagePoint, InterestTag, Route, RouteStop } from "@/lib/types";

export interface PlanInput {
  points: HeritagePoint[];
  narrationSecByPoint: Record<string, number>;
  // empty means the Visitor said nothing, which means everything
  interests: InterestTag[];
  budgetSec: number;
  start: Coord;
  walkSpeedMs: number;
}

// held-karp is exact but doubles in cost per point, so it only runs on a real site's worth
const EXACT_ORDER_LIMIT = 12;

function walkSec(from: Coord, to: Coord, speedMs: number): number {
  return metresBetween(from, to) / speedMs;
}

function matchesInterests(point: HeritagePoint, interests: InterestTag[]): boolean {
  return interests.length === 0 || point.tags.some((tag) => interests.includes(tag));
}

// importance dominates, so a Visitor never loses an unmissable place to a better tag match
function score(point: HeritagePoint, interests: InterestTag[]): number {
  const overlap = point.tags.filter((tag) => interests.includes(tag)).length;
  return point.importance * 10 + overlap;
}

function nearestFirst(points: HeritagePoint[], start: Coord, speedMs: number): HeritagePoint[] {
  const left = [...points];
  const order: HeritagePoint[] = [];
  let from = start;
  while (left.length > 0) {
    let pick = 0;
    for (let i = 1; i < left.length; i++) {
      if (walkSec(from, left[i].centroid, speedMs) < walkSec(from, left[pick].centroid, speedMs)) pick = i;
    }
    const [next] = left.splice(pick, 1);
    order.push(next);
    from = next.centroid;
  }
  return order;
}

function shortestOrder(points: HeritagePoint[], start: Coord, speedMs: number): HeritagePoint[] {
  const n = points.length;
  if (n === 0) return [];
  if (n > EXACT_ORDER_LIMIT) return nearestFirst(points, start, speedMs);

  const fromStart = points.map((p) => walkSec(start, p.centroid, speedMs));
  const between = points.map((a) => points.map((b) => walkSec(a.centroid, b.centroid, speedMs)));

  const size = 1 << n;
  const best = Array.from({ length: size }, () => new Array<number>(n).fill(Infinity));
  const came = Array.from({ length: size }, () => new Array<number>(n).fill(-1));
  for (let i = 0; i < n; i++) best[1 << i][i] = fromStart[i];

  for (let mask = 1; mask < size; mask++) {
    for (let last = 0; last < n; last++) {
      if (!(mask & (1 << last)) || best[mask][last] === Infinity) continue;
      for (let next = 0; next < n; next++) {
        if (mask & (1 << next)) continue;
        const merged = mask | (1 << next);
        const cost = best[mask][last] + between[last][next];
        if (cost < best[merged][next]) {
          best[merged][next] = cost;
          came[merged][next] = last;
        }
      }
    }
  }

  const full = size - 1;
  let end = 0;
  for (let i = 1; i < n; i++) if (best[full][i] < best[full][end]) end = i;

  const reversed: number[] = [];
  let mask = full;
  let last = end;
  while (last !== -1) {
    reversed.push(last);
    const previous = came[mask][last];
    mask ^= 1 << last;
    last = previous;
  }
  return reversed.reverse().map((i) => points[i]);
}

function toStops(
  ordered: HeritagePoint[],
  input: PlanInput,
): { stops: RouteStop[]; totalSec: number } {
  let from = input.start;
  const stops = ordered.map((point) => {
    const stop: RouteStop = {
      pointId: point.id,
      walkSecFromPrevious: walkSec(from, point.centroid, input.walkSpeedMs),
      narrationSec: input.narrationSecByPoint[point.id] ?? 0,
    };
    from = point.centroid;
    return stop;
  });
  return { stops, totalSec: stops.reduce((sum, s) => sum + s.walkSecFromPrevious + s.narrationSec, 0) };
}

export function planRoute(input: PlanInput): Route {
  // sorting by id under the score keeps the same inputs giving the same Route every time
  const eligible = input.points
    .filter((p) => matchesInterests(p, input.interests))
    .sort((a, b) => score(b, input.interests) - score(a, input.interests) || a.id.localeCompare(b.id));

  const taken = [...eligible];
  const dropped: string[] = [];

  while (taken.length > 0) {
    const ordered = shortestOrder(taken, input.start, input.walkSpeedMs);
    const { stops, totalSec } = toStops(ordered, input);
    if (totalSec <= input.budgetSec || taken.length === 1) {
      return { stops, totalSec, droppedPointIds: dropped };
    }
    dropped.push(taken.pop()!.id);
  }

  return { stops: [], totalSec: 0, droppedPointIds: dropped };
}
