"use client";

import type { Candidate, Mention } from "@/lib/types";

export function verdictLabel(candidate: Candidate | null): string {
  if (!candidate) return "Not placed";
  switch (candidate.evidence.baselineVerdict) {
    case "matched_existing":
      return "On today's map";
    case "representation_gap":
      return "Representation Gap";
    default:
      return "Too wide to check";
  }
}

function verdictColour(candidate: Candidate | null): string {
  if (!candidate) return "text-ink-faint";
  switch (candidate.evidence.baselineVerdict) {
    case "matched_existing":
      return "text-state-matched";
    case "representation_gap":
      return "text-madder";
    default:
      return "text-ink-faint";
  }
}

export default function MentionCard({
  mention,
  candidate,
  isOpen,
  onOpen,
}: {
  mention: Mention;
  candidate: Candidate | null;
  isOpen: boolean;
  onOpen: () => void;
}) {
  const clue = mention.spatialClue;

  return (
    <li className={`border-b border-ink-faint/20 ${isOpen ? "bg-paper-sunk" : ""}`}>
      <button type="button" onClick={onOpen} className="w-full px-4 py-3 text-left">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-lg leading-tight text-ink">{mention.name}</span>
          <span className="font-archive shrink-0 text-[11px] text-ink-faint">{mention.type}</span>
        </div>

        {mention.period && <p className="font-archive text-[11px] text-ink-faint">{mention.period}</p>}

        {clue ? (
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            {clue.distanceValue !== null && clue.distanceUnit !== null
              ? `${clue.distanceValue} ${clue.distanceUnit} `
              : ""}
            {clue.bearing} of {clue.anchorName}
          </p>
        ) : (
          <p className="mt-1 text-xs text-ink-faint">The page gives no location.</p>
        )}

        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className={`font-archive text-[11px] tracking-wide uppercase ${verdictColour(candidate)}`}>
            {verdictLabel(candidate)}
          </span>
          {candidate && (
            <span className="font-archive text-[11px] text-ink-faint">
              {Math.round(candidate.uncertaintyRadiusM)} m &middot;{" "}
              {candidate.confidence.total.toFixed(2)}
            </span>
          )}
        </div>

        {mention.passageOffset === null ? (
          <p className="mt-1 text-[11px] leading-relaxed text-madder">
            This passage is not in the page. The model composed it rather than copying it, so
            nothing here is placed.
          </p>
        ) : (
          !candidate &&
          clue && (
            <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
              The survey measures this from {clue.anchorName}, which is not in the Anchor table. It
              is not placed rather than placed wrongly.
            </p>
          )
        )}
      </button>
    </li>
  );
}
