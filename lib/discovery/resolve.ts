import { moveBy } from "@/lib/location/geometry";
import type { Anchor, BearingToken, Coord, DistanceUnit, SpatialClue } from "@/lib/types";

export interface RadiusParts {
  anchorPrecisionM: number;
  bearingSpreadM: number;
  distanceVaguenessM: number;
  floorTopUpM: number;
}

export type Resolution =
  | {
      status: "resolved";
      centroid: Coord;
      uncertaintyRadiusM: number;
      anchor: Anchor;
      distanceM: number | null;
      bearingDeg: number | null;
      radiusParts: RadiusParts;
    }
  | { status: "unresolved"; reason: "unknown_anchor" | "no_clue" };

const BEARING_DEG: Record<BearingToken, number | null> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
  adjacent: null, within: null, opposite: null,
};

// metres per unit, and how loose the surveyor's number is as a fraction of the distance
const UNITS: Record<DistanceUnit, { metres: number; vagueness: number }> = {
  feet: { metres: 0.3048, vagueness: 0.15 },
  yards: { metres: 0.9144, vagueness: 0.15 },
  furlongs: { metres: 201.168, vagueness: 0.25 },
  miles: { metres: 1609.344, vagueness: 0.25 },
  // a pace is one person's stride, so it travels worse than a chained yard
  paces: { metres: 0.762, vagueness: 0.3 },
  // plan/03 puts a kos in the Delhi region anywhere from 1.8 to 3.2 km
  gaz: { metres: 0.838, vagueness: 0.25 },
  kos: { metres: 2500, vagueness: 0.3 },
};

// the survey writes an eight point compass, so a named direction covers 45 degrees
const HALF_SECTOR_TAN = Math.tan((22.5 * Math.PI) / 180);

// a direction with no distance still says nothing about how far, so the circle has to hold the anchor
const NO_DISTANCE_ALLOWANCE_M = 150;

// no clue read off a page is a five metre claim, however tidy it looks
const RADIUS_FLOOR_M = 25;

function normalise(name: string): string {
  return name.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]/g, "");
}

function findAnchor(name: string, anchors: Anchor[]): Anchor | null {
  const wanted = normalise(name);
  if (!wanted) return null;
  for (const anchor of anchors) {
    if (normalise(anchor.name) === wanted) return anchor;
    if (anchor.aliases.some((alias) => normalise(alias) === wanted)) return anchor;
  }
  return null;
}

export function resolveClue(clue: SpatialClue | null, anchors: Anchor[]): Resolution {
  if (!clue) return { status: "unresolved", reason: "no_clue" };

  const anchor = findAnchor(clue.anchorName, anchors);
  if (!anchor) return { status: "unresolved", reason: "unknown_anchor" };

  const bearingDeg = BEARING_DEG[clue.bearing];
  const unit = clue.distanceUnit === null ? null : UNITS[clue.distanceUnit];
  const measured =
    unit === null || clue.distanceValue === null
      ? null
      : { metres: clue.distanceValue * unit.metres, vagueness: unit.vagueness };
  const distanceM = measured === null ? null : measured.metres;
  const canProject = distanceM !== null && bearingDeg !== null;

  const anchorPrecisionM = anchor.precisionM;
  const bearingSpreadM = canProject ? distanceM * HALF_SECTOR_TAN : 0;
  const distanceVaguenessM = measured === null ? NO_DISTANCE_ALLOWANCE_M : measured.metres * measured.vagueness;
  const summed = anchorPrecisionM + bearingSpreadM + distanceVaguenessM;

  return {
    status: "resolved",
    centroid: canProject ? moveBy(anchor.centroid, distanceM, bearingDeg) : anchor.centroid,
    uncertaintyRadiusM: Math.max(summed, RADIUS_FLOOR_M),
    anchor,
    distanceM,
    bearingDeg,
    radiusParts: {
      anchorPrecisionM,
      bearingSpreadM,
      distanceVaguenessM,
      // named rather than hidden, so the four numbers on the Evidence panel add up to the circle
      floorTopUpM: Math.max(RADIUS_FLOOR_M - summed, 0),
    },
  };
}
