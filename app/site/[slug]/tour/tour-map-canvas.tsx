"use client";

import { divIcon } from "leaflet";
import { MapContainer, Marker, Polygon, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ringToLeaflet, sector, toLeaflet } from "@/lib/location/geometry";
import { TRIGGER_CONFIG } from "@/lib/location/config";
import type { PreparedPoint, TriggerStatus } from "@/lib/location/engine";
import type { Coord, Fix, HeritagePoint, HeritageSite } from "@/lib/types";

const VISITOR_ICON = divIcon({
  className: "",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#F4EDE0;border:2px solid #1F1B16;cursor:grab"></div>',
});

export default function TourMapCanvas({
  site,
  points,
  prepared,
  statuses,
  fix,
  selectedId,
  onSelect,
  onMoveVisitor,
}: {
  site: HeritageSite;
  points: HeritagePoint[];
  prepared: PreparedPoint[];
  statuses: TriggerStatus[];
  fix: Fix;
  selectedId: string | null;
  onSelect: (point: HeritagePoint) => void;
  onMoveVisitor: (to: Coord) => void;
}) {
  const at: Coord = [fix.lng, fix.lat];
  const dwelling = statuses.filter((s) => s.dwellMs > 0).sort((a, b) => b.dwellMs - a.dwellMs)[0];
  const progress = dwelling ? Math.min(1, dwelling.dwellMs / TRIGGER_CONFIG.dwellMs) : 0;

  const cone =
    fix.headingDeg === null
      ? null
      : sector(
          at,
          30,
          fix.headingDeg - TRIGGER_CONFIG.facingToleranceDeg,
          fix.headingDeg + TRIGGER_CONFIG.facingToleranceDeg,
        );

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

      {prepared.map((point) => (
        <Polygon
          key={`${point.pointId}-ring`}
          positions={ringToLeaflet(point.ring.coordinates[0])}
          pathOptions={{ color: "#9A8F7C", weight: 1, dashArray: "3 4", fill: false }}
          interactive={false}
        />
      ))}

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

      {cone && (
        <Polygon
          positions={ringToLeaflet(cone.coordinates[0])}
          pathOptions={{ color: "#9A3412", weight: 1, fillColor: "#9A3412", fillOpacity: 0.1 }}
          interactive={false}
        />
      )}

      {progress > 0 && (
        <Polygon
          positions={ringToLeaflet(sector(at, 7, 0, 360 * progress).coordinates[0])}
          pathOptions={{ color: "#9A3412", weight: 2, fillColor: "#9A3412", fillOpacity: 0.35 }}
          interactive={false}
        />
      )}

      <Marker
        position={toLeaflet(at)}
        draggable
        icon={VISITOR_ICON}
        eventHandlers={{
          drag: (event) => {
            const { lat, lng } = event.target.getLatLng();
            onMoveVisitor([lng, lat]);
          },
        }}
      >
        <Tooltip direction="top" offset={[0, -10]}>
          You
        </Tooltip>
      </Marker>
    </MapContainer>
  );
}
