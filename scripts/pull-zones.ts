import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// a Zone is the structure's real footprint, so we take OSM's traced way rather than draw one
const ZONES: Record<string, number> = {
  "red-fort/lahori-gate": 80429907,
  "red-fort/naubat-khana": 80429900,
  "red-fort/diwan-i-aam": 80429794,
  "red-fort/rang-mahal": 80429915,
  "red-fort/khas-mahal": 80429887,
  "red-fort/diwan-i-khas": 80429830,
  "red-fort/hammam": 223903620,
  "red-fort/mumtaz-mahal": 80429815,
};

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

interface OverpassWay {
  type: "way";
  id: number;
  geometry: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

async function query(ql: string): Promise<OverpassWay[]> {
  // the public instances are frequently busy, so every mirror gets three tries
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const mirror of MIRRORS) {
      const res = await fetch(mirror, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "threshold-sih2026 (heritage research, one-off pull)",
        },
        body: new URLSearchParams({ data: ql }),
      });
      const text = await res.text();
      if (res.ok && text.startsWith("{")) {
        const elements = (JSON.parse(text) as { elements: OverpassWay[] }).elements;
        if (elements.length > 0) return elements;
        console.log(`  ${mirror} has no data for this area`);
        continue;
      }
      console.log(`  ${mirror} is busy`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("every overpass mirror refused; content/zones left as it was");
}

function ring(way: OverpassWay): [number, number][] {
  const coords = way.geometry.map((p) => [p.lon, p.lat] as [number, number]);
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first);
  return coords;
}

function centroid(ring: [number, number][]): [number, number] {
  // drop the repeated closing vertex so it does not weight twice
  const pts = ring.slice(0, -1);
  const lng = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
}

async function main() {
  const ids = Object.values(ZONES);
  const ways = await query(`[out:json][timeout:120];\nway(id:${ids.join(",")});\nout geom tags;`);
  console.log(`${ways.length} of ${ids.length} ways returned`);

  await mkdir(join("content", "zones"), { recursive: true });
  const byId = new Map(ways.map((w) => [w.id, w]));

  for (const [pointId, wayId] of Object.entries(ZONES)) {
    const way = byId.get(wayId);
    if (!way) {
      console.log(`  MISSING w${wayId} for ${pointId}`);
      continue;
    }
    const coords = ring(way);
    const feature = {
      type: "Feature" as const,
      id: pointId,
      geometry: { type: "Polygon" as const, coordinates: [coords] },
      properties: {
        pointId,
        osmName: way.tags?.name ?? null,
        source: `OpenStreetMap way ${wayId}, ODbL`,
        centroid: centroid(coords),
      },
    };
    const file = join("content", "zones", `${pointId.replace("/", "-")}.geojson`);
    await writeFile(file, JSON.stringify(feature) + "\n");
    console.log(`  ${pointId} <- w${wayId} "${way.tags?.name}" ${coords.length} vertices`);
  }
}

main();
