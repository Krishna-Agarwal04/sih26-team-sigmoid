"use client";

import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { toLeaflet } from "@/lib/location/geometry";
import type { HeritageSite } from "@/lib/types";

const DELHI: [number, number] = [28.605, 77.215];

export default function ExploreMapCanvas({
  sites,
  selectedId,
  onSelect,
}: {
  sites: HeritageSite[];
  selectedId: string | null;
  onSelect: (site: HeritageSite) => void;
}) {
  return (
    <MapContainer center={DELHI} zoom={12} scrollWheelZoom className="h-full w-full bg-paper-sunk">
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={20}
      />
      {sites.map((site) => (
        <CircleMarker
          key={site.id}
          center={toLeaflet(site.centroid)}
          radius={site.depth === "deep" ? 9 : 6}
          pathOptions={{
            color: site.id === selectedId ? "#1F1B16" : "#9A3412",
            weight: 2,
            fillColor: site.depth === "deep" ? "#9A3412" : "#FAF6EE",
            fillOpacity: site.depth === "deep" ? 0.8 : 1,
          }}
          eventHandlers={{ click: () => onSelect(site) }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            {site.name}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
