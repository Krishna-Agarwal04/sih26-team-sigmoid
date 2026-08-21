import { describe, expect, test } from "vitest";
import { metresBetween } from "@/lib/location/geometry";
import { resolveClue } from "@/lib/discovery/resolve";
import type { RadiusParts } from "@/lib/discovery/resolve";
import type { Anchor, SpatialClue } from "@/lib/types";

const KHAIR_UL_MANAZIL: Anchor = {
  id: "khair-ul-manazil",
  name: "Khair-ul-Manazil",
  aliases: ["Khairul Manazil", "Khair-ul-Manazil Masjid"],
  centroid: [77.239555, 28.607493],
  precisionM: 40,
};

// a road runs for miles, so naming one barely pins anything down
const MUTTRA_ROAD: Anchor = {
  id: "delhi-muttra-road",
  name: "Delhi-Muttra Road",
  aliases: ["Mathura Road"],
  centroid: [77.2436, 28.5966],
  precisionM: 2000,
};

const ANCHORS = [KHAIR_UL_MANAZIL, MUTTRA_ROAD];

function sumOfParts(parts: RadiusParts): number {
  return parts.anchorPrecisionM + parts.bearingSpreadM + parts.distanceVaguenessM + parts.floorTopUpM;
}

function clue(over: Partial<SpatialClue> = {}): SpatialClue {
  return { anchorName: "Khair-ul-Manazil", bearing: "N", distanceValue: 400, distanceUnit: "yards", ...over };
}

describe("resolving a Spatial Clue", () => {
  test("projects the stated distance in the stated direction from the Anchor", () => {
    const r = resolveClue(clue(), ANCHORS);
    if (r.status !== "resolved") throw new Error("expected a resolution");

    expect(metresBetween(KHAIR_UL_MANAZIL.centroid, r.centroid)).toBeCloseTo(400 * 0.9144, 0);
    expect(r.centroid[1]).toBeGreaterThan(KHAIR_UL_MANAZIL.centroid[1]);
    expect(r.bearingDeg).toBe(0);
  });

  test("the Uncertainty Radius is exactly the sum of its named parts", () => {
    const r = resolveClue(clue(), ANCHORS);
    if (r.status !== "resolved") throw new Error("expected a resolution");

    expect(sumOfParts(r.radiusParts)).toBeCloseTo(r.uncertaintyRadiusM, 6);
    expect(r.radiusParts.anchorPrecisionM).toBe(KHAIR_UL_MANAZIL.precisionM);
  });

  test("a kos distance gives a far wider radius than the same number of yards", () => {
    const inYards = resolveClue(clue({ distanceValue: 2, distanceUnit: "yards" }), ANCHORS);
    const inKos = resolveClue(clue({ distanceValue: 2, distanceUnit: "kos" }), ANCHORS);
    if (inYards.status !== "resolved" || inKos.status !== "resolved") throw new Error("expected resolutions");

    expect(inKos.uncertaintyRadiusM).toBeGreaterThan(inYards.uncertaintyRadiusM * 10);
    // plan/03 puts a kos in the Delhi region at 1.8 to 3.2 km, so two of them is a few kilometres out
    expect(metresBetween(KHAIR_UL_MANAZIL.centroid, inKos.centroid)).toBeGreaterThan(4000);
  });

  test("gaz is a period unit too, so it is not treated as a precise one", () => {
    const inGaz = resolveClue(clue({ distanceValue: 400, distanceUnit: "gaz" }), ANCHORS);
    const inYards = resolveClue(clue({ distanceValue: 400, distanceUnit: "yards" }), ANCHORS);
    if (inGaz.status !== "resolved" || inYards.status !== "resolved") throw new Error("expected resolutions");

    expect(inGaz.radiusParts.distanceVaguenessM).toBeGreaterThan(inYards.radiusParts.distanceVaguenessM);
  });

  test("an Anchor nobody can find leaves the Mention unresolved, with no coordinate at all", () => {
    const r = resolveClue(clue({ anchorName: "No. 51" }), ANCHORS);

    expect(r.status).toBe("unresolved");
    expect(r).not.toHaveProperty("centroid");
    if (r.status !== "unresolved") throw new Error("expected no resolution");
    expect(r.reason).toBe("unknown_anchor");
  });

  test("the spellings the volume uses still find the Anchor", () => {
    for (const name of ["Khairul Manazil", "khair ul manazil", "  Khair-ul-Manazil Masjid ", "the Khairul Manazil"]) {
      const r = resolveClue(clue({ anchorName: name }), ANCHORS);
      expect(r.status, name).toBe("resolved");
    }
  });

  test("a vague Anchor widens the radius even when the clue itself is precise", () => {
    const fromMosque = resolveClue(clue(), ANCHORS);
    const fromRoad = resolveClue(clue({ anchorName: "Delhi-Muttra Road" }), ANCHORS);
    if (fromMosque.status !== "resolved" || fromRoad.status !== "resolved") throw new Error("expected resolutions");

    expect(fromRoad.uncertaintyRadiusM).toBeGreaterThan(fromMosque.uncertaintyRadiusM);
    expect(fromRoad.radiusParts.anchorPrecisionM).toBe(MUTTRA_ROAD.precisionM);
  });

  test("a bearing with no distance sits on the Anchor rather than guessing how far", () => {
    const r = resolveClue(clue({ distanceValue: null, distanceUnit: null }), ANCHORS);
    if (r.status !== "resolved") throw new Error("expected a resolution");

    expect(r.centroid).toEqual(KHAIR_UL_MANAZIL.centroid);
    expect(r.distanceM).toBeNull();
    // the direction is still known and the Evidence panel says so
    expect(r.bearingDeg).toBe(0);
    expect(r.uncertaintyRadiusM).toBeGreaterThan(KHAIR_UL_MANAZIL.precisionM);
  });

  test("adjacent, within and opposite carry no direction, so the centre is the Anchor", () => {
    for (const bearing of ["adjacent", "within", "opposite"] as const) {
      const r = resolveClue(clue({ bearing, distanceValue: null, distanceUnit: null }), ANCHORS);
      if (r.status !== "resolved") throw new Error("expected a resolution");
      expect(r.centroid, bearing).toEqual(KHAIR_UL_MANAZIL.centroid);
      expect(r.bearingDeg, bearing).toBeNull();
    }
  });

  test("a longer distance spreads the compass point wider on the ground", () => {
    const near = resolveClue(clue({ distanceValue: 100 }), ANCHORS);
    const far = resolveClue(clue({ distanceValue: 1000 }), ANCHORS);
    if (near.status !== "resolved" || far.status !== "resolved") throw new Error("expected resolutions");

    expect(far.radiusParts.bearingSpreadM).toBeGreaterThan(near.radiusParts.bearingSpreadM * 5);
  });

  test("even the tidiest clue keeps a floor under its radius, and the floor is a named part", () => {
    const tight: Anchor = { ...KHAIR_UL_MANAZIL, precisionM: 0 };
    const r = resolveClue(clue({ distanceValue: 1, distanceUnit: "feet" }), [tight]);
    if (r.status !== "resolved") throw new Error("expected a resolution");

    expect(r.uncertaintyRadiusM).toBeGreaterThanOrEqual(25);
    // the Evidence panel shows these four numbers, so they have to add up to the circle it draws
    expect(sumOfParts(r.radiusParts)).toBeCloseTo(r.uncertaintyRadiusM, 6);
    expect(r.radiusParts.floorTopUpM).toBeGreaterThan(0);
  });

  test("a clue that already clears the floor gets no top-up", () => {
    const r = resolveClue(clue(), ANCHORS);
    if (r.status !== "resolved") throw new Error("expected a resolution");

    expect(r.radiusParts.floorTopUpM).toBe(0);
  });
});
