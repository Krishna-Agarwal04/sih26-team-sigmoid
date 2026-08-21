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

The survey lists numbered entries. Each has lettered parts: (a) is the name, (b) is where it stands, (e) is the period, (j) is the description. The scan is imperfect OCR, so letters and numbers are sometimes wrong.

Return one entry per structure the page names. For each:
- name: as the page gives it. Use "Unknown" if part (a) says the name is unknown.
- type: the closest of the listed kinds.
- period: as printed, or null.
- passage: the exact run of characters from the page text that locates the structure, normally part (b). Copy it character for character. Do not tidy the OCR.
- spatialClue: read part (b).
  - anchorName: the landmark it measures from, as the page writes it. When part (b) gives both a numbered entry and a named landmark, always take the landmark. A number cannot be found on a map and a landmark can. Only put a numbered entry such as "No. 51" when the page names nothing else.
  - bearing: the compass direction. Use adjacent when the page says a structure stands on, by or beside something without giving a direction, within when it is inside something, and opposite when it faces something.
  - distanceValue and distanceUnit: the number and its unit. "half a mile" is 0.5 miles. "a furlong" is 1 furlongs. Use null for both when no distance is given.
  - null for the whole clue only when part (b) gives no location at all. Standing on a named road is a location.

When the clue names a landmark, the passage you copy must be the part of the page that names it.

Report only what the page says. Never supply a name, period, direction or distance the page does not print.`;

function locate(passage: string, pageText: string): [number, number] | null {
  const at = pageText.indexOf(passage);
  if (at >= 0) return [at, at + passage.length];

  // OCR breaks lines mid sentence, so match again ignoring where the whitespace fell
  const words = passage.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (words.length === 0) return null;
  const match = new RegExp(words.join("\\s+")).exec(pageText);
  return match ? [match.index, match.index + match[0].length] : null;
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
    passageOffset: locate(m.passage, pageText) ?? [0, 0],
    spatialClue: m.spatialClue,
  }));

  return { ok: true, extraction: { mentions, modelId: result.modelId } };
}
