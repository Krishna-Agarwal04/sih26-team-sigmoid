import type { Coord } from "@/lib/types";

// leaflet wants lat,lng and everything else here is lng,lat. this is the only place that flips
export function toLeaflet(coord: Coord): [number, number] {
  return [coord[1], coord[0]];
}

export function ringToLeaflet(ring: number[][]): [number, number][] {
  return ring.map((c) => [c[1], c[0]]);
}
