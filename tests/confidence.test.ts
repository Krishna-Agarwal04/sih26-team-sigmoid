import { describe, expect, test } from "vitest";
import type { BaselineCheck } from "@/lib/discovery/baseline";
import { CONFIDENCE_WEIGHTS, scoreConfidence } from "@/lib/discovery/confidence";
import type { ConfidenceInput } from "@/lib/discovery/confidence";
import type { ConfidenceParts, SpatialClue } from "@/lib/types";

const MATCHED: BaselineCheck = {
  verdict: "matched_existing",
  match: { id: "n1", name: "Sabz Burj", distanceM: 40 },
  checked: [{ id: "n1", name: "Sabz Burj", distanceM: 40, insideRadius: true }],
};

const GAP: BaselineCheck = { verdict: "representation_gap", match: null, checked: [] };

function input(over: Partial<ConfidenceInput> = {}): ConfidenceInput {
  const clue: SpatialClue = { anchorName: "Khair-ul-Manazil", bearing: "N", distanceValue: 400, distanceUnit: "yards" };
  return { clue, anchorPrecisionM: 40, uncertaintyRadiusM: 250, baseline: GAP, sourceReliability: 0.9, ...over };
}

function weighted(parts: ConfidenceParts): number {
  return (Object.keys(CONFIDENCE_WEIGHTS) as (keyof ConfidenceParts)[])
    .reduce((sum, k) => sum + parts[k] * CONFIDENCE_WEIGHTS[k], 0);
}

describe("scoring a Candidate's Confidence", () => {
  test("the weights sum to one and the total is the weighted sum of the parts", () => {
    const total = Object.values(CONFIDENCE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 6);

    const c = scoreConfidence(input());
    expect(c.total).toBeCloseTo(weighted(c.parts), 6);
  });

  test("nothing can look certain while only one Volume has been read", () => {
    const best = scoreConfidence(input({
      anchorPrecisionM: 0,
      sourceReliability: 1,
      baseline: MATCHED,
      clue: { anchorName: "x", bearing: "N", distanceValue: 10, distanceUnit: "feet" },
    }));

    expect(best.parts.crossSourceAgreement).toBe(0);
    expect(best.total).toBeLessThanOrEqual(1 - CONFIDENCE_WEIGHTS.crossSourceAgreement + 1e-9);
  });

  test("a chained clue from a pinned Anchor beats a kos clue from a named road", () => {
    const tight = scoreConfidence(input());
    const loose = scoreConfidence(input({
      anchorPrecisionM: 2000,
      clue: { anchorName: "Delhi-Muttra Road", bearing: "S", distanceValue: 2, distanceUnit: "kos" },
    }));

    expect(tight.total).toBeGreaterThan(loose.total);
    expect(tight.parts.clueSpecificity).toBeGreaterThan(loose.parts.clueSpecificity);
    expect(tight.parts.anchorPrecision).toBeGreaterThan(loose.parts.anchorPrecision);
  });

  test("a Representation Gap does not score zero, because OSM's silence proves little", () => {
    const gap = scoreConfidence(input({ baseline: GAP }));

    expect(gap.parts.modernEvidence).toBeGreaterThan(0);
    expect(gap.parts.modernEvidence).toBeLessThan(0.5);
  });

  test("something already on today's map corroborates the projection", () => {
    const matched = scoreConfidence(input({ baseline: MATCHED }));
    const gap = scoreConfidence(input({ baseline: GAP }));

    expect(matched.parts.modernEvidence).toBeGreaterThan(gap.parts.modernEvidence);
    expect(matched.total).toBeGreaterThan(gap.total);
  });

  test("a match near the centre corroborates more than one at the edge of the circle", () => {
    const near = scoreConfidence(input({
      baseline: { ...MATCHED, match: { id: "n1", name: "a", distanceM: 10 } },
    }));
    const edge = scoreConfidence(input({
      baseline: { ...MATCHED, match: { id: "n1", name: "a", distanceM: 240 } },
    }));

    expect(near.parts.modernEvidence).toBeGreaterThan(edge.parts.modernEvidence);
  });

  test("a clue that gives a direction but no distance is less specific than one that measures", () => {
    const measured = scoreConfidence(input());
    const vague = scoreConfidence(input({
      clue: { anchorName: "Khair-ul-Manazil", bearing: "N", distanceValue: null, distanceUnit: null },
    }));

    expect(vague.parts.clueSpecificity).toBeLessThan(measured.parts.clueSpecificity);
  });

  test("a clue with no direction at all is the least specific of the three", () => {
    const directional = scoreConfidence(input({
      clue: { anchorName: "x", bearing: "N", distanceValue: null, distanceUnit: null },
    }));
    const not = scoreConfidence(input({
      clue: { anchorName: "x", bearing: "adjacent", distanceValue: null, distanceUnit: null },
    }));

    expect(not.parts.clueSpecificity).toBeLessThan(directional.parts.clueSpecificity);
  });

  test("every part and the total stay inside nought to one", () => {
    const cases = [
      input(),
      input({ baseline: MATCHED, anchorPrecisionM: 0, sourceReliability: 1 }),
      input({ anchorPrecisionM: 5000, sourceReliability: 0, clue: { anchorName: "x", bearing: "within", distanceValue: null, distanceUnit: null } }),
    ];

    for (const c of cases) {
      const scored = scoreConfidence(c);
      for (const [name, value] of Object.entries(scored.parts)) {
        expect(value, name).toBeGreaterThanOrEqual(0);
        expect(value, name).toBeLessThanOrEqual(1);
      }
      expect(scored.total).toBeGreaterThanOrEqual(0);
      expect(scored.total).toBeLessThanOrEqual(1);
    }
  });
});
