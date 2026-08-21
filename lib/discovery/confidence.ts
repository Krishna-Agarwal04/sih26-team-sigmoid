import type { BaselineCheck } from "@/lib/discovery/baseline";
import type { Confidence, ConfidenceParts, DistanceUnit, SpatialClue } from "@/lib/types";

export interface ConfidenceInput {
  clue: SpatialClue;
  anchorPrecisionM: number;
  uncertaintyRadiusM: number;
  baseline: BaselineCheck;
  sourceReliability: number;
}

// shown on the Evidence panel beside the parts, so a reader can redo the arithmetic
export const CONFIDENCE_WEIGHTS: Record<keyof ConfidenceParts, number> = {
  clueSpecificity: 0.3,
  anchorPrecision: 0.3,
  sourceReliability: 0.15,
  modernEvidence: 0.15,
  crossSourceAgreement: 0.1,
};

// how much a unit narrows things down, which is not the same as how long it is
const UNIT_SPECIFICITY: Record<DistanceUnit, number> = {
  feet: 1, yards: 0.95, paces: 0.75, gaz: 0.7, furlongs: 0.6, miles: 0.5, kos: 0.25,
};

const NO_DISTANCE_SPECIFICITY = 0.3;
const NO_DIRECTION_PENALTY = 0.6;

// the metres at which an Anchor is worth half marks
const ANCHOR_HALF_MARKS_M = 100;

// OSM is incomplete, which is this whole product's premise, so its silence is weak evidence
const GAP_EVIDENCE = 0.35;

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clueSpecificity(clue: SpatialClue): number {
  const measured = clue.distanceUnit === null || clue.distanceValue === null
    ? NO_DISTANCE_SPECIFICITY
    : UNIT_SPECIFICITY[clue.distanceUnit];
  const directional = clue.bearing !== "adjacent" && clue.bearing !== "within" && clue.bearing !== "opposite";
  return clamp(measured * (directional ? 1 : NO_DIRECTION_PENALTY));
}

function modernEvidence(baseline: BaselineCheck, uncertaintyRadiusM: number): number {
  if (!baseline.match) return GAP_EVIDENCE;
  // a match at the centre corroborates the projection, one at the rim barely does
  const howCentral = uncertaintyRadiusM > 0 ? 1 - baseline.match.distanceM / uncertaintyRadiusM : 1;
  return clamp(0.5 + 0.5 * howCentral);
}

export function scoreConfidence(input: ConfidenceInput): Confidence {
  const parts: ConfidenceParts = {
    clueSpecificity: clueSpecificity(input.clue),
    anchorPrecision: clamp(ANCHOR_HALF_MARKS_M / (ANCHOR_HALF_MARKS_M + input.anchorPrecisionM)),
    sourceReliability: clamp(input.sourceReliability),
    modernEvidence: modernEvidence(input.baseline, input.uncertaintyRadiusM),
    // stays nought until a second Volume is read, so no Candidate can look certain yet. F23
    crossSourceAgreement: 0,
  };

  const total = (Object.keys(CONFIDENCE_WEIGHTS) as (keyof ConfidenceParts)[])
    .reduce((sum, key) => sum + parts[key] * CONFIDENCE_WEIGHTS[key], 0);

  return { total, parts };
}
