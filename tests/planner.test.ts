import { describe, expect, test } from "vitest";
import { centroid as diwanIAamAt, zone as diwanIAamZone } from "@/content/zones/red-fort-diwan-i-aam";
import { centroid as diwanIKhasAt, zone as diwanIKhasZone } from "@/content/zones/red-fort-diwan-i-khas";
import { centroid as hammamAt, zone as hammamZone } from "@/content/zones/red-fort-hammam";
import { centroid as lahoriGateAt, zone as lahoriGateZone } from "@/content/zones/red-fort-lahori-gate";
import { centroid as rangMahalAt, zone as rangMahalZone } from "@/content/zones/red-fort-rang-mahal";
import { metresBetween } from "@/lib/location/geometry";
import { planRoute } from "@/lib/route/planner";
import type { PlanInput } from "@/lib/route/planner";
import type { Coord, HeritagePoint, Importance, InterestTag } from "@/lib/types";

function point(
  id: string,
  zone: GeoJSON.Polygon,
  centroid: Coord,
  tags: InterestTag[],
  importance: Importance,
): HeritagePoint {
  return { id, siteId: "red-fort", name: id, tags, importance, zone, centroid, livingTradition: null };
}

const POINTS = [
  point("lahori-gate", lahoriGateZone, lahoriGateAt, ["history", "military"], 3),
  point("diwan-i-aam", diwanIAamZone, diwanIAamAt, ["history", "architecture"], 3),
  point("rang-mahal", rangMahalZone, rangMahalAt, ["architecture", "culture_traditions"], 2),
  point("diwan-i-khas", diwanIKhasZone, diwanIKhasAt, ["history", "architecture"], 3),
  point("hammam", hammamZone, hammamAt, ["architecture"], 1),
];

const NARRATION_SEC = {
  "lahori-gate": 40,
  "diwan-i-aam": 42,
  "rang-mahal": 44,
  "diwan-i-khas": 43,
  hammam: 30,
};

function input(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    points: POINTS,
    narrationSecByPoint: NARRATION_SEC,
    interests: [],
    budgetSec: 90 * 60,
    start: lahoriGateAt,
    walkSpeedMs: 1.2,
    ...overrides,
  };
}

describe("Route planner", () => {
  test("a generous budget takes every Heritage Point, and the total is the sum of its parts", () => {
    const route = planRoute(input());

    expect(route.stops.map((s) => s.pointId).sort()).toEqual(POINTS.map((p) => p.id).sort());
    expect(route.droppedPointIds).toEqual([]);

    const parts = route.stops.reduce((sum, s) => sum + s.walkSecFromPrevious + s.narrationSec, 0);
    expect(route.totalSec).toBeCloseTo(parts, 5);
    expect(route.totalSec).toBeLessThanOrEqual(input().budgetSec);
  });

  test("Interest Tags decide membership, and choosing none means everything", () => {
    const military = planRoute(input({ interests: ["military"] }));
    expect(military.stops.map((s) => s.pointId)).toEqual(["lahori-gate"]);

    const everything = planRoute(input({ interests: [] }));
    expect(everything.stops).toHaveLength(POINTS.length);
  });

  test("a tighter budget takes fewer Heritage Points, and gives up the least important first", () => {
    const generous = planRoute(input({ budgetSec: 90 * 60 }));
    const budgetSec = generous.totalSec * 0.7;
    const tight = planRoute(input({ budgetSec }));

    expect(tight.stops.length).toBeGreaterThan(0);
    expect(tight.stops.length).toBeLessThan(generous.stops.length);
    expect(tight.totalSec).toBeLessThanOrEqual(budgetSec);
    // hammam is the only importance 1 point here, so it is the first thing to go
    expect(tight.droppedPointIds).toContain("hammam");
    expect([...tight.stops.map((s) => s.pointId), ...tight.droppedPointIds].sort()).toEqual(
      POINTS.map((p) => p.id).sort(),
    );
  });

  test("orders the Heritage Points so the Visitor walks as little as possible", () => {
    const route = planRoute(input());
    const planned = route.stops.reduce((sum, s) => sum + s.walkSecFromPrevious, 0);

    // the order they happen to be listed in is one valid order, so the plan must beat or match it
    let from = lahoriGateAt;
    let asListed = 0;
    for (const point of POINTS) {
      asListed += metresBetween(from, point.centroid) / 1.2;
      from = point.centroid;
    }

    expect(planned).toBeLessThanOrEqual(asListed + 0.001);
  });

  test("gives the same Route for the same inputs every time", () => {
    const once = planRoute(input({ interests: ["architecture"], budgetSec: 600 }));
    const twice = planRoute(input({ interests: ["architecture"], budgetSec: 600 }));
    expect(twice).toEqual(once);
  });
});
