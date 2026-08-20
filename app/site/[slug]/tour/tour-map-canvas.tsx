"use client";

import { MapContainer, Polygon, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ringToLeaflet, toLeaflet } from "@/lib/location/geometry";
import type { HeritagePoint, HeritageSite } from "@/lib/types";

export default function TourMapCanvas({
  site,
  points,
  selectedId,
  onSelect,
}: {
  site: HeritageSite;
  points: HeritagePoint[];
  selectedId: string | null;
  onSelect: (point: HeritagePoint) => void;
}) {
  return (
    <MapContainer
      center={toLeaflet(site.centroid)}
      zoom={18}
      scrollWheelZoom
      className="h-full w-full bg-paper-sunk"
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={20}
      />
      {points.map((point) => (
        <Polygon
          key={point.id}
          positions={ringToLeaflet(point.zone.coordinates[0])}
          pathOptions={{
            color: point.id === selectedId ? "#9A3412" : "#1E3A5F",
            weight: point.id === selectedId ? 2 : 1,
            fillColor: point.id === selectedId ? "#9A3412" : "#1E3A5F",
            fillOpacity: 0.12,
          }}
          eventHandlers={{ click: () => onSelect(point) }}
        >
          <Tooltip direction="top" sticky>
            {point.name}
          </Tooltip>
        </Polygon>
      ))}
    </MapContainer>
  );
}
