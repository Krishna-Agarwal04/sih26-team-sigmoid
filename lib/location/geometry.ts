import { bearing, booleanPointInPolygon, buffer, distance, polygon as polygonFeature } from "@turf/turf";
import type { Coord } from "@/lib/types";

// leaflet wants lat,lng and everything else here is lng,lat. this is the only place that flips
export function toLeaflet(coord: Coord): [number, number] {
  return [coord[1], coord[0]];
}

export function ringToLeaflet(ring: number[][]): [number, number][] {
  return ring.map((c) => [c[1], c[0]]);
}

export function approachRing(zone: GeoJSON.Polygon, meters: number): GeoJSON.Polygon {
  const buffered = buffer(polygonFeature(zone.coordinates), meters, { units: "meters" });
  if (!buffered) throw new Error("turf could not buffer this Zone");
  if (buffered.geometry.type !== "Polygon") throw new Error("buffering a Zone split it in two");
  return buffered.geometry;
}

export function isInside(at: Coord, polygon: GeoJSON.Polygon): boolean {
  return booleanPointInPolygon(at, polygon);
}

export function bearingTo(from: Coord, to: Coord): number {
  const degrees = bearing(from, to);
  return degrees < 0 ? degrees + 360 : degrees;
}

// how far a heading is from where it would have to point, 0 to 180
export function headingOffBy(headingDeg: number, targetBearingDeg: number): number {
  const raw = Math.abs(headingDeg - targetBearingDeg) % 360;
  return raw > 180 ? 360 - raw : raw;
}

export function metresBetween(from: Coord, to: Coord): number {
  return distance(from, to, { units: "meters" });
}
