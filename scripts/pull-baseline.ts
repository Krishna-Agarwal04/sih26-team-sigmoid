import { mkdir, writeFile } from "node:fs/promises";

const BBOX = { south: 28.4, west: 76.84, north: 28.88, east: 77.35 };

const QUERY = `[out:json][timeout:180];
(
  nwr["historic"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  nwr["heritage"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  nwr["tourism"="attraction"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
);
out center tags;`;

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

async function main() {
  let body: { elements: OverpassElement[] } | null = null;
  for (const mirror of MIRRORS) {
    const res = await fetch(mirror, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "threshold-sih2026 (heritage research, one-off pull)",
      },
      body: new URLSearchParams({ data: QUERY }),
    });
    if (res.ok) {
      body = (await res.json()) as { elements: OverpassElement[] };
      console.log(`pulled from ${mirror}`);
      break;
    }
    console.log(`  ${mirror} said ${res.status} ${res.statusText}, trying the next mirror`);
  }
  if (body === null) throw new Error("every overpass mirror refused; content/baseline.geojson left as it was");

  console.log(`${body.elements.length} elements returned`);

  const features = body.elements
    .map((el) => {
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      const tags = el.tags ?? {};
      if (lat === undefined || lon === undefined) return null;
      return {
        type: "Feature" as const,
        id: `${el.type[0]}${el.id}`,
        geometry: { type: "Point" as const, coordinates: [lon, lat] },
        properties: {
          name: tags.name ?? tags["name:en"] ?? null,
          historic: tags.historic ?? null,
          heritage: tags.heritage ?? null,
          tourism: tags.tourism ?? null,
        },
      };
    })
    .filter((f) => f !== null);

  const named = features.filter((f) => f.properties.name !== null).length;
  console.log(`${features.length} point features, ${named} of them named`);

  const out = {
    type: "FeatureCollection" as const,
    // committed snapshot, so the query that produced it has to travel with it
    query: QUERY,
    source: "OpenStreetMap contributors, via the Overpass API. ODbL.",
    pulledAt: new Date().toISOString().slice(0, 10),
    features,
  };

  await mkdir("content", { recursive: true });
  await writeFile("content/baseline.geojson", JSON.stringify(out) + "\n");
  console.log("wrote content/baseline.geojson");
}

main();
