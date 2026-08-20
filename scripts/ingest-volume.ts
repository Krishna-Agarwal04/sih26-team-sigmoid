import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const VOLUMES = {
  "zafar-hasan-v1": {
    archiveId: "in.ernet.dli.2015.70478",
    stem: "2015.70478.List-Of-Muhammadan-And-Hindu-Monuments-Vol1",
    title: "List of Muhammadan and Hindu Monuments, Delhi Province, Vol. I",
  },
  "zafar-hasan-v2": {
    archiveId: "in.ernet.dli.2015.69530",
    stem: "2015.69530.List-Of-Muhammadan-And-Hindu-Monuments-Vol2",
    title: "List of Muhammadan and Hindu Monuments, Delhi Province, Vol. II",
  },
  "zafar-hasan-v3": {
    archiveId: "in.ernet.dli.2015.69531",
    stem: "2015.69531.List-Of-Muhammadan-And-Hindu-Monuments-Vol3",
    title: "List of Muhammadan and Hindu Monuments, Delhi Province, Vol. III",
  },
} as const;

type VolumeId = keyof typeof VOLUMES;

const PAGE_COUNT = 40;

// a Spatial Clue in these volumes reads "Some 300 yards to the north of X"
const DISTANCE = /\b\d{1,4}\s*(?:yards?|miles?|kos|gaz|paces|furlongs?)\b/gi;
const BEARING = /\b(?:north|south|east|west|N\.\s*[EW]\.|S\.\s*[EW]\.)\b/gi;
const LOCATION_FIELD = /^\s*[({[]\s*[b6h5&]\s*[)}\]]/gim;

function pageText(objectXml: string): string {
  const lines: string[] = [];
  for (const line of objectXml.matchAll(/<LINE>(.*?)<\/LINE>/gs)) {
    const words = [...line[1].matchAll(/<WORD[^>]*>(.*?)<\/WORD>/gs)].map((w) => w[1].trim());
    if (words.length > 0) lines.push(words.join(" "));
  }
  return lines
    .join("\n")
    .replaceAll("&apos;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

// these scans carry the printed number alone on the first or last line
function printedPageNo(text: string): number | null {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  for (const line of [lines[0], lines[1], lines.at(-1)]) {
    const m = line?.trim().match(/^(\d{1,3})$/);
    if (m) return Number(m[1]);
  }
  return null;
}

function clueScore(text: string): number {
  const distances = text.match(DISTANCE)?.length ?? 0;
  const bearings = text.match(BEARING)?.length ?? 0;
  const fields = text.match(LOCATION_FIELD)?.length ?? 0;
  return distances * 3 + bearings + fields;
}

async function fetchOrDie(url: string, kind: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${kind} failed: ${res.status} ${res.statusText} for ${url}`);
  return res;
}

async function main() {
  const volumeId = (process.argv[2] ?? "zafar-hasan-v2") as VolumeId;
  const volume = VOLUMES[volumeId];
  if (!volume) throw new Error(`unknown volume ${volumeId}, expected one of ${Object.keys(VOLUMES).join(", ")}`);

  const base = `https://archive.org/download/${volume.archiveId}`;
  console.log(`reading ${volume.title}`);

  const xml = await (await fetchOrDie(`${base}/${volume.stem}_djvu.xml`, "text layer")).text();
  const objects = xml.split(/(?=<OBJECT )/).slice(1);
  console.log(`  ${objects.length} scanned pages`);

  const scanned = objects.map((object) => {
    const scanIndex = Number(object.match(/usemap="[^"]*?_(\d{4})\.djvu"/)?.[1] ?? -1);
    const text = pageText(object);
    return { scanIndex, text, printedPageNo: printedPageNo(text), score: clueScore(text) };
  });

  const chosen = scanned
    .filter((p) => p.scanIndex >= 0 && p.text.length > 600)
    .sort((a, b) => b.score - a.score)
    .slice(0, PAGE_COUNT)
    .sort((a, b) => a.scanIndex - b.scanIndex);

  console.log(`  keeping ${chosen.length} pages, clue score ${chosen.at(-1)?.score} to ${Math.max(...chosen.map((p) => p.score))}`);

  const imageDir = join("public", "pages", volumeId);
  await mkdir(imageDir, { recursive: true });
  await mkdir("content/pages", { recursive: true });

  for (const page of chosen) {
    const name = `n${page.scanIndex}.jpg`;
    const res = await fetchOrDie(`${base}/page/n${page.scanIndex}_w800.jpg`, "page image");
    await writeFile(join(imageDir, name), Buffer.from(await res.arrayBuffer()));
    process.stdout.write(`\r  downloaded ${name}                `);
    // archive.org asks for roughly one request a second
    await new Promise((r) => setTimeout(r, 1100));
  }
  console.log();

  const out = {
    volumeId,
    title: volume.title,
    archiveId: volume.archiveId,
    sourceUrl: `https://archive.org/details/${volume.archiveId}`,
    licence: "Public domain",
    pages: chosen.map((p) => ({
      pageNo: p.scanIndex,
      printedPageNo: p.printedPageNo,
      imageUrl: `/pages/${volumeId}/n${p.scanIndex}.jpg`,
      clueScore: p.score,
      text: p.text,
    })),
  };
  await writeFile(join("content", "pages", `${volumeId}.json`), JSON.stringify(out, null, 2) + "\n");
  console.log(`wrote content/pages/${volumeId}.json`);
}

main();
