import { approachRing, bearingTo, headingOffBy, isInside, metresBetween } from "./geometry";
import type { Coord, Fix, HeritagePoint, ThresholdCrossing } from "@/lib/types";

export interface EngineConfig {
  dwellMs: number;
  facingToleranceDeg: number;
  approachBufferM: number;
  dwellDriftM: number;
  rearmBufferM: number;
  rearmMs: number;
}

export interface PreparedPoint {
  pointId: string;
  centroid: Coord;
  zone: GeoJSON.Polygon;
  ring: GeoJSON.Polygon;
  rearmRing: GeoJSON.Polygon;
}

export interface TriggerStatus {
  pointId: string;
  inRing: boolean;
  facing: boolean;
  offByDeg: number | null;
  driftM: number;
  dwellMs: number;
  fired: boolean;
  inZone: boolean;
}

export interface PointState {
  fired: boolean;
  firedInside: boolean;
  // when the Visitor got fully clear of the ring, or null while they are still near it
  clearSinceT: number | null;
  dwellMs: number;
  // where the Visitor was when this stretch of Dwell began
  dwellFrom: Coord | null;
}

export interface EngineState {
  points: Record<string, PointState>;
  lastT: number | null;
}

export interface StepResult {
  state: EngineState;
  crossings: ThresholdCrossing[];
  statuses: TriggerStatus[];
}

export function prepare(points: HeritagePoint[], config: EngineConfig): PreparedPoint[] {
  return points.map((point) => ({
    pointId: point.id,
    centroid: point.centroid,
    zone: point.zone,
    ring: approachRing(point.zone, config.approachBufferM),
    rearmRing: approachRing(point.zone, config.approachBufferM + config.rearmBufferM),
  }));
}

const UNVISITED: PointState = {
  fired: false,
  firedInside: false,
  clearSinceT: null,
  dwellMs: 0,
  dwellFrom: null,
};

export function initialState(): EngineState {
  return { points: {}, lastT: null };
}

export function step(
  state: EngineState,
  fix: Fix,
  prepared: PreparedPoint[],
  config: EngineConfig,
): StepResult {
  const at: Coord = [fix.lng, fix.lat];
  const elapsed = state.lastT === null ? 0 : Math.max(0, fix.t - state.lastT);

  const points: Record<string, PointState> = {};
  const statuses: TriggerStatus[] = [];
  const crossings: ThresholdCrossing[] = [];

  for (const point of prepared) {
    const before = state.points[point.pointId] ?? UNVISITED;
    const inRing = isInside(at, point.ring);
    const offByDeg =
      fix.headingDeg === null ? null : headingOffBy(fix.headingDeg, bearingTo(at, point.centroid));
    // no compass means the Facing gate turns off rather than blocking the crossing
    const facing = offByDeg === null || offByDeg <= config.facingToleranceDeg;
    const driftM = before.dwellFrom === null ? 0 : metresBetween(before.dwellFrom, at);

    // someone still walking has not arrived, so Dwell only counts while they stay put
    const held = inRing && facing && before.dwellFrom !== null && driftM <= config.dwellDriftM;
    const clear = !isInside(at, point.rearmRing);
    const clearSinceT = clear ? (before.clearSinceT ?? fix.t) : null;
    const rearmed = before.fired && clearSinceT !== null && fix.t - clearSinceT >= config.rearmMs;

    const next: PointState = held
      ? { ...before, clearSinceT, dwellMs: before.dwellMs + elapsed }
      : { ...before, clearSinceT, dwellMs: 0, dwellFrom: inRing && facing ? at : null };
    if (rearmed) {
      next.fired = false;
      next.firedInside = false;
    }

    if (!next.fired && next.dwellMs >= config.dwellMs) {
      crossings.push({ pointId: point.pointId, kind: "approach", t: fix.t });
      next.fired = true;
    }

    // the detail is a reward for going in, so it only follows a Heritage Point that has spoken
    if (next.fired && !next.firedInside && isInside(at, point.zone)) {
      crossings.push({ pointId: point.pointId, kind: "inside", t: fix.t });
      next.firedInside = true;
    }

    points[point.pointId] = next;
    statuses.push({
      pointId: point.pointId,
      inRing,
      facing,
      offByDeg,
      driftM,
      dwellMs: next.dwellMs,
      fired: next.fired,
      inZone: isInside(at, point.zone),
    });
  }

  return { state: { points, lastT: fix.t }, crossings, statuses };
}
