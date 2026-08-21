import { z } from "zod";
import { generateJson } from "@/lib/ai/model";
import type { Mention } from "@/lib/types";

const STRUCTURE_TYPES = [
  "mosque", "tomb", "gateway", "fort_wall", "palace", "pavilion",
  "stepwell", "caravanserai", "garden", "bridge", "well",
  "temple", "madrasa", "hammam", "tower", "other",
] as const;

const BEARINGS = [
  "N", "NE", "E", "SE", "S", "SW", "W", "NW",
  "adjacent", "within", "opposite",
] as const;

const DISTANCE_UNITS = ["yards", "feet", "miles", "furlongs", "kos", "paces", "gaz"] as const;

// no passageOffset here on purpose. models are poor at counting characters, so we find the
// passage in the Page text ourselves and drop the highlight if it is not there.
const ExtractedMention = z.object({
  name: z.string(),
  type: z.enum(STRUCTURE_TYPES),
  period: z.string().nullable(),
  passage: z.string(),
  spatialClue: z
    .object({
      anchorName: z.string(),
      bearing: z.enum(BEARINGS),
      distanceValue: z.number().nullable(),
      distanceUnit: z.enum(DISTANCE_UNITS).nullable(),
    })
    .nullable(),
});

const ExtractedPage = z.object({ mentions: z.array(ExtractedMention) });

const SYSTEM = `You read pages from a 1919 archaeological survey of the Delhi district and return what they record.

Most pages list numbered entries. Each has lettered parts: (a) is the name, (b) is where it stands, (e) is the period, (j) is the description. The scan is imperfect OCR, so letters and numbers are sometimes wrong.

Some pages are running prose instead, describing one building over several paragraphs. Read those the same way. Their locations are written into the sentences, as in "the observatory is 3 miles 3 furlongs almost due south from the Pir Ghaib" or "1 mile 7 furlongs west of south from the Jama Masjid". Those are Spatial Clues and you must return them.

Return one entry per structure the page names. For each:
- name: as the page gives it. Use "Unknown" if part (a) says the name is unknown.
- type: the closest of the listed kinds.
- period: as printed, or null.
- passage: the exact run of characters from the page text that locates the structure, normally part (b). Copy it character for character, starting after the lettered marker. Do not tidy the OCR: if the page reads "Delhi-Mutfcra" then so does your passage. A passage that cannot be found in the page verbatim is treated as unverified and the structure is not placed on the map, so copying matters more than reading well.
- spatialClue: read part (b).
  - anchorName: the landmark it measures from, as the page writes it, and nothing else. Give the shortest name that identifies it, not the description around it: from "the Pir Ghaib, the Trigonometrical Survey point on the Ridge, near to Hindu Rao's House" the name is "Pir Ghaib". Keep the page's spelling, however odd. When part (b) gives both a numbered entry and a named landmark, always take the landmark. A number cannot be found on a map and a landmark can. Only put a numbered entry such as "No. 51" when the page names nothing else.
  - bearing: the compass direction. Use adjacent when the page says a structure stands on, by or beside something without giving a direction, within when it is inside something, and opposite when it faces something.
  - distanceValue and distanceUnit: the number and its unit. "half a mile" is 0.5 miles. "a furlong" is 1 furlongs. A distance given in two units, such as "3 miles 3 furlongs", becomes one number in the larger unit: 3.375 miles. Use null for both when no distance is given.
  - null for the whole clue only when part (b) gives no location at all. Standing on a named road is a location.

When the clue names a landmark, the passage you copy must be the part of the page that names it.

Report only what the page says. Never supply a name, period, direction or distance the page does not print.`;

// The survey breaks words across lines with a hyphen, so the page holds "hori-\nzontal" where
// the model returns "horizontal". Flattening both sides lets them meet, and the map carries
// each flattened character back to where it really sits in the page.
function flatten(text: string): { flat: string; map: number[] } {
  const chars: string[] = [];
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "-" && /^[^\S\n]*\n/.test(text.slice(i + 1))) {
      while (i + 1 < text.length && text[i + 1] !== "\n") i++;
      i++;
      continue;
    }
    if (/\s/.test(char)) {
      if (chars[chars.length - 1] === " ") continue;
      chars.push(" ");
    } else {
      chars.push(char);
    }
    map.push(i);
  }
  return { flat: chars.join(""), map };
}

function locate(passage: string, pageText: string): [number, number] | null {
  const at = pageText.indexOf(passage);
  if (at >= 0) return [at, at + passage.length];

  const page = flatten(pageText);
  // the scan mangles the lettered markers into {b) and («), and the model tidies them back to
  // (b), so the marker is dropped before matching. it is not part of what the page says.
  for (const candidate of [passage, passage.replace(/^\s*[({[]\s*\S\s*[)}\]]\s*/, "")]) {
    const wanted = flatten(candidate).flat.trim();
    if (wanted.length === 0) continue;
    const found = page.flat.indexOf(wanted);
    if (found >= 0) return [page.map[found], page.map[found + wanted.length - 1] + 1];
  }
  return null;
}

export interface Extraction {
  mentions: Mention[];
  modelId: string;
}

export async function extractMentions(
  pageNo: number,
  pageText: string,
): Promise<{ ok: true; extraction: Extraction } | { ok: false; reason: string }> {
  const result = await generateJson(
    {
      system: SYSTEM,
      user: `Page ${pageNo}.\n\n${pageText}`,
      jsonSchema: z.toJSONSchema(ExtractedPage, { io: "output" }) as Record<string, unknown>,
      schemaName: "survey_page",
    },
    ExtractedPage,
  );

  if (!result.ok) return { ok: false, reason: result.reason };

  const mentions: Mention[] = result.value.mentions.map((m, i) => ({
    id: `m_${pageNo}_${i + 1}`,
    name: m.name,
    type: m.type,
    period: m.period,
    passage: m.passage,
    passageOffset: locate(m.passage, pageText),
    spatialClue: m.spatialClue,
  }));

  return { ok: true, extraction: { mentions, modelId: result.modelId } };
}
