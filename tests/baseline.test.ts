import { describe, expect, test } from "vitest";
import { checkBaseline } from "@/lib/discovery/baseline";
import type { BaselineFeature } from "@/lib/discovery/baseline";
import { moveBy } from "@/lib/location/geometry";
import type { Coord } from "@/lib/types";

const AT: Coord = [77.24, 28.6];

function feature(id: string, name: string | null, metresAway: number, headingDeg = 90): BaselineFeature {
  return {
    type: "Feature",
    id,
    geometry: { type: "Point", coordinates: moveBy(AT, metresAway, headingDeg) },
    properties: { name, historic: "ruins", heritage: null, tourism: null },
  };
}

describe("checking a Candidate against the Modern Baseline", () => {
  test("something mapped inside the radius is a match, named and measured", () => {
    const r = checkBaseline(AT, 200, [feature("n1", "Sabz Burj", 120)]);

    expect(r.verdict).toBe("matched_existing");
    expect(r.match?.name).toBe("Sabz Burj");
    expect(r.match?.id).toBe("n1");
    expect(r.match?.distanceM).toBeCloseTo(120, 0);
  });

  test("nothing inside the radius is a Representation Gap", () => {
    const r = checkBaseline(AT, 100, [feature("n1", "Sabz Burj", 400)]);

    expect(r.verdict).toBe("representation_gap");
    expect(r.match).toBeNull();
  });

  test("a Gap still names the nearest thing on today's map, so the Evidence panel is never empty", () => {
    const r = checkBaseline(AT, 100, [feature("n1", "Sabz Burj", 400), feature("n2", "Nila Gumbad", 900)]);

    expect(r.verdict).toBe("representation_gap");
    expect(r.checked[0].name).toBe("Sabz Burj");
    expect(r.checked[0].insideRadius).toBe(false);
    expect(r.checked[0].distanceM).toBeCloseTo(400, 0);
  });

  test("with two inside the radius, the nearer one is the match", () => {
    const r = checkBaseline(AT, 500, [feature("n1", "Further", 300), feature("n2", "Nearer", 80)]);

    expect(r.match?.name).toBe("Nearer");
    expect(r.checked.map((c) => c.id)).toEqual(["n2", "n1"]);
  });

  test("an unmapped name is still a mapped thing, so it closes the Gap and says what it is", () => {
    const r = checkBaseline(AT, 200, [feature("n7", null, 90)]);

    expect(r.verdict).toBe("matched_existing");
    expect(r.match?.id).toBe("n7");
    // a Reviewer has to be able to go and look at it
    expect(r.match?.name).toContain("unnamed");
    expect(r.match?.name).toContain("ruins");
  });

  test("the verdict follows the radius, not the distance on its own", () => {
    const baseline = [feature("n1", "Sabz Burj", 300)];

    expect(checkBaseline(AT, 200, baseline).verdict).toBe("representation_gap");
    expect(checkBaseline(AT, 400, baseline).verdict).toBe("matched_existing");
  });

  test("an empty Modern Baseline is a Gap, not a crash", () => {
    const r = checkBaseline(AT, 200, []);

    expect(r.verdict).toBe("representation_gap");
    expect(r.match).toBeNull();
    expect(r.checked).toEqual([]);
  });

  test("only the nearest handful are carried, in order", () => {
    const many = Array.from({ length: 20 }, (_, i) => feature(`n${i}`, `f${i}`, 1000 - i * 10));
    const r = checkBaseline(AT, 100, many);

    expect(r.checked).toHaveLength(5);
    expect(r.checked[0].id).toBe("n19");
    const gaps = r.checked.map((c) => c.distanceM);
    expect([...gaps].sort((a, b) => a - b)).toEqual(gaps);
  });
});

describe("a circle too wide to conclude anything from", () => {
  test("a kilometres-wide radius cannot support a match, however close the feature", () => {
    const r = checkBaseline(AT, 2500, [feature("n1", "Sabz Burj", 90)]);

    expect(r.verdict).toBe("inconclusive");
    expect(r.match).toBeNull();
    // the nearest features still come back, so the panel can show what was in range
    expect(r.checked[0].name).toBe("Sabz Burj");
  });

  test("nor can it support a Representation Gap, because half of Delhi is inside it", () => {
    const r = checkBaseline(AT, 2500, []);

    expect(r.verdict).toBe("inconclusive");
  });

  test("a radius under the limit still decides one way or the other", () => {
    expect(checkBaseline(AT, 400, [feature("n1", "Sabz Burj", 90)]).verdict).toBe("matched_existing");
    expect(checkBaseline(AT, 400, [feature("n1", "Sabz Burj", 900)]).verdict).toBe("representation_gap");
  });
});
