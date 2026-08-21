"use client";

import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { toLeaflet } from "@/lib/location/geometry";
import type { Candidate } from "@/lib/types";

const DELHI: [number, number] = [28.605, 77.215];

const VERDICT_COLOUR: Record<Candidate["evidence"]["baselineVerdict"], string> = {
  matched_existing: "#6B21A8",
  representation_gap: "#9A3412",
  inconclusive: "#9A8F7C",
};

// the map holds whatever the last Analyse produced, so it has to move when that changes
function FitToCandidates({ candidates }: { candidates: Candidate[] }) {
  const map = useMap();

  useEffect(() => {
    if (candidates.length === 0) return;
    const points = candidates.map((c) => toLeaflet(c.centroid));
    map.fitBounds(points as [number, number][], { padding: [40, 40], maxZoom: 15 });
  }, [candidates, map]);

  return null;
}

export default function DiscoverMapCanvas({
  candidates,
  openId,
  onOpen,
}: {
  candidates: Candidate[];
  openId: string | null;
  onOpen: (mentionId: string) => void;
}) {
  return (
    <MapContainer center={DELHI} zoom={11} scrollWheelZoom className="h-full w-full bg-paper-sunk">
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={20}
      />
      <FitToCandidates candidates={candidates} />

      {candidates.map((c) => {
        const colour = VERDICT_COLOUR[c.evidence.baselineVerdict];
        const isOpen = c.mentionId === openId;
        return (
          <div key={c.id}>
            {/* the line back to the Anchor is the claim: this is what it was measured from */}
            {isOpen && (
              <Polyline
                positions={[toLeaflet(c.evidence.anchorCentroid), toLeaflet(c.centroid)]}
                pathOptions={{ color: "#1F1B16", weight: 1, dashArray: "3 4", opacity: 0.7 }}
              />
            )}
            <Circle
              center={toLeaflet(c.centroid)}
              radius={c.uncertaintyRadiusM}
              pathOptions={{
                color: colour,
                weight: 1,
                fillColor: colour,
                fillOpacity: isOpen ? 0.18 : 0.08,
              }}
              eventHandlers={{ click: () => onOpen(c.mentionId) }}
            />
            <CircleMarker
              center={toLeaflet(c.centroid)}
              radius={isOpen ? 6 : 4}
              pathOptions={{ color: colour, weight: 2, fillColor: colour, fillOpacity: 1 }}
              eventHandlers={{ click: () => onOpen(c.mentionId) }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                {Math.round(c.uncertaintyRadiusM)} m radius
              </Tooltip>
            </CircleMarker>
            {isOpen && (
              <CircleMarker
                center={toLeaflet(c.evidence.anchorCentroid)}
                radius={4}
                pathOptions={{ color: "#1F1B16", weight: 2, fillColor: "#FAF6EE", fillOpacity: 1 }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  {c.evidence.anchorName}
                </Tooltip>
              </CircleMarker>
            )}
          </div>
        );
      })}
    </MapContainer>
  );
}
