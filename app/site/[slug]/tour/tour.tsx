"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import NarrationPlayer from "./narration-player";
import type { FactSheet, HeritagePoint, HeritageSite, Narration } from "@/lib/types";

// leaflet reads window while it loads, so it must never render on the server
const TourMapCanvas = dynamic(() => import("./tour-map-canvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-paper-sunk" />,
});

export default function Tour({
  site,
  points,
  narrations,
  factSheets,
}: {
  site: HeritageSite;
  points: HeritagePoint[];
  narrations: Narration[];
  factSheets: FactSheet[];
}) {
  const [selected, setSelected] = useState<HeritagePoint>(points[0]);
  const [showEvidence, setShowEvidence] = useState(false);

  const narration = narrations.find((n) => n.pointId === selected.id);
  const factSheet = factSheets.find((f) => f.pointId === selected.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="h-72 shrink-0 lg:h-auto lg:min-h-0 lg:flex-1">
        <TourMapCanvas
          site={site}
          points={points}
          selectedId={selected.id}
          onSelect={(p) => {
            setSelected(p);
            setShowEvidence(false);
          }}
        />
      </div>

      <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-y-auto border-t border-ink-faint/40 bg-paper p-4 lg:w-[26rem] lg:border-t-0 lg:border-l">
        <p className="font-archive text-xs tracking-widest text-ink-faint uppercase">{site.name}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {points.map((point) => (
            <button
              key={point.id}
              type="button"
              onClick={() => {
                setSelected(point);
                setShowEvidence(false);
              }}
              className={`border px-3 py-1.5 text-sm ${
                point.id === selected.id
                  ? "border-madder bg-madder text-paper"
                  : "border-ink-faint/50 text-ink-muted hover:border-madder hover:text-madder"
              }`}
            >
              {point.name}
            </button>
          ))}
        </div>

        <h1 className="font-display mt-5 text-4xl leading-none text-ink">{selected.name}</h1>
        {selected.nameLocal && (
          <p className="font-deva text-lg text-ink-muted">{selected.nameLocal}</p>
        )}

        <div className="mt-4">
          {narration ? (
            <NarrationPlayer narration={narration} />
          ) : (
            <p className="border border-ink-faint/40 bg-paper-raised p-4 text-sm text-ink-muted">
              No Narration written for this Heritage Point yet.
            </p>
          )}
        </div>

        {selected.livingTradition && (
          <div className="mt-4 border border-ink-faint/40 bg-paper-raised p-4">
            <p className="font-archive text-xs tracking-widest text-ink-faint uppercase">
              Living tradition &middot; {selected.livingTradition.status}
            </p>
            <h2 className="font-display mt-1 text-2xl text-ink">{selected.livingTradition.name}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {selected.livingTradition.text}
            </p>
          </div>
        )}

        {factSheet && (
          <div className="mt-4 border border-ink-faint/40 bg-paper-raised p-4">
            <button
              type="button"
              onClick={() => setShowEvidence(!showEvidence)}
              className="font-archive text-xs tracking-widest text-indigo uppercase hover:text-madder"
            >
              {showEvidence ? "Hide" : "Show"} evidence &middot; {factSheet.lines.length} sourced
              lines
            </button>
            {showEvidence && (
              <div className="mt-3 space-y-3">
                {factSheet.lines.map((line) => (
                  <div key={line.id}>
                    <p className="text-sm leading-relaxed text-ink">{line.text}</p>
                    <p className="font-archive mt-1 text-xs text-ink-faint">{line.source}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="font-archive mt-4 pb-2 text-xs leading-relaxed text-ink-faint">
          Zone footprints from OpenStreetMap, ODbL. Narration read by en-IN-PrabhatNeural.
        </p>
      </aside>
    </div>
  );
}
