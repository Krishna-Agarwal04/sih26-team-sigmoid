# BRIEF 1 - Agent build spec

**For a coding agent building the Discovery Engine.** Read `BRIEF-1-discovery-engine.md` first for the why. This file is the executable version: exact files, exact signatures, exact prompts, and a verification gate after every step.

Owner: Shantanu. Repo: standalone, your own.

---

## 0. Rules that override the agent's defaults

An agent left alone will over-build this. It will not.

- **Simple and boring beats clever.** The obvious solution wins every time.
- **No abstraction until something is needed twice.** No provider interfaces, no strategy patterns, no config system, no dependency injection, no plugin layer. A single caller does not justify an interface.
- **No `any`, no `@ts-ignore`.** If the type is hard, the design is wrong.
- **No em dashes anywhere.** Not in code, comments, or UI text. Use a simple hyphen with spaces around it.
- **Never invent a requirement.** If this spec does not say, stop and ask Shantanu. Do not guess and do not quietly expand scope.
- **Never place an unresolvable Mention at a guessed coordinate.** Return `null` and display it as unresolvable. This is the single most important behavioural rule in the whole task.
- **Every external call has its fallback in the same function.** Not in a wrapper, not in an error boundary. It must be impossible to read the call without seeing what happens when it fails.
- Build in the order below. **Run the gate at the end of each step before starting the next one.**

### Vocabulary, used exactly

`Volume` a scanned archival publication. `Page` one leaf of it, image plus text. `Mention` a passage naming a structure, a claim the archive made. `Spatial Clue` the written description of where it stands, relative to an `Anchor`. `Uncertainty Radius` the distance within which the projected structure is believed to lie. `Candidate` a structure projected from the record, unconfirmed. `Modern Baseline` today's record of what is mapped. `Representation Gap` a Candidate with nothing from the Baseline inside its radius. `Confidence` a decomposable score, never a verdict.

**Never write "discovered a monument" or "AI found"** in code, comments or UI. The archive recorded it, we projected it, a human confirms it. Say "surfaced a Candidate" or "identified a Representation Gap".

---

## Step 1. Scaffold

```bash
npx create-next-app@16.3.1 discovery --ts --tailwind --app --no-src-dir --eslint
cd discovery
pnpm add @google/genai@2.17.1 @turf/turf@7.4.0 zod@4.4.3 leaflet@1.9.4 react-leaflet@5.0.0
pnpm add -D vitest@4.1.11 @types/leaflet tsx
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"typecheck": "tsc --noEmit",
"ingest": "tsx scripts/ingest.ts",
"build-cache": "tsx scripts/build-cache.ts",
"pull-baseline": "tsx scripts/pull-baseline.ts",
"verify": "tsx scripts/verify.ts"
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["tests/**/*.test.ts"] } });
```

Create `.env.local` with a free key from https://aistudio.google.com/apikey:

```
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.7-flash
GEMINI_TIMEOUT_MS=8000
```

Add `.env.local` to `.gitignore`. Confirm with `git check-ignore -v .env.local`.

**GATE 1:** `pnpm dev` serves a page, `pnpm typecheck` passes, `.env.local` is ignored by git.

---

## Step 2. Types

Create `lib/types.ts` with exactly this content. Do not rename a field, change a type, or add one.

```ts
export type StructureType =
  | 'mosque' | 'tomb' | 'gateway' | 'fort_wall' | 'palace' | 'pavilion'
  | 'stepwell' | 'caravanserai' | 'garden' | 'bridge' | 'well'
  | 'temple' | 'madrasa' | 'hammam' | 'tower' | 'other';

export type DistanceUnit = 'yards' | 'feet' | 'miles' | 'kos' | 'paces' | 'gaz';

export type BearingToken =
  | 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'
  | 'adjacent' | 'within' | 'opposite';

export type CandidateStatus =
  | 'extracted' | 'geo_resolved' | 'candidate'
  | 'under_review' | 'verified' | 'rejected' | 'matched_existing';

export interface SpatialClue {
  anchorName: string;
  bearing: BearingToken | null;
  distanceValue: number | null;
  distanceUnit: DistanceUnit | null;
}

export interface Mention {
  id: string;                        // "m_87_1" = page 87, first mention
  name: string;
  type: StructureType;
  period: string | null;
  passage: string;                   // verbatim from the page text
  passageOffset: [number, number];   // char range into the page text
  spatialClue: SpatialClue | null;
}

export interface ConfidenceParts {
  sourceReliability: number;
  clueSpecificity: number;
  anchorPrecision: number;
  crossSourceAgreement: number;      // always 0 for now, reserved
  modernEvidence: number;
}

export interface Candidate {
  id: string;                        // "c_87_1", matches its Mention
  mentionId: string;
  centroid: [number, number] | null; // [lng, lat] GeoJSON order. null = unresolvable
  uncertaintyRadiusM: number | null;
  status: CandidateStatus;
  matchedBaselineFeature: { id: string; name: string; distanceM: number } | null;
  confidence: { total: number; parts: ConfidenceParts };
}

export interface Anchor {
  id: string;
  name: string;
  aliases: string[];
  centroid: [number, number];        // [lng, lat]
  precisionM: number;
}

export interface BaselineFeature {
  id: string;                        // "node/123456"
  name: string;
  centroid: [number, number];        // [lng, lat]
}
```

### The coordinate rule

**Every coordinate in this codebase is `[lng, lat]`.** GeoJSON order, which turf requires. Leaflet wants `[lat, lng]`, which is the reverse.

Create `lib/geo.ts` with the only permitted flip:

```ts
export const toLeaflet = (c: [number, number]): [number, number] => [c[1], c[0]];
```

Nothing else anywhere in the codebase may reorder a coordinate pair. If pins land in the Arabian Sea, this rule was broken.

**GATE 2:** `pnpm typecheck` passes.

---

## Step 3. Ingest the Volume

Source: Archaeological Survey of India, *List of Muhammadan and Hindu Monuments, Delhi Province*, Vol. 1 (1916). Public domain. Internet Archive id `in.ernet.dli.2015.70478`, 231 pages.

Write `scripts/ingest.ts` to run **once** and commit its output. It must:

1. Download the OCR text layer:
   `https://archive.org/download/in.ernet.dli.2015.70478/2015.70478.List-Of-Muhammadan-And-Hindu-Monuments-Vol1_djvu.txt`
2. Split it into pages. The djvu text uses form feed (`\f`) as a page separator. If that fails, fall back to splitting on the page-number headers and log which method was used.
3. Pick **20 pages** with the highest density of spatial language. Score a page by counting matches of `/\b(north|south|east|west|yards|miles|kos|gaz|paces|adjoining|opposite|near|situated)\b/gi` and take the top 20.
4. For each chosen page N, download the scan:
   `https://archive.org/download/in.ernet.dli.2015.70478/page/n{N}_w800.jpg` into `public/pages/n{N}.jpg`
5. Write `content/pages.ts` exporting `PAGES: { pageNo: number; text: string; imageUrl: string }[]`.

Rate limit: sleep 500ms between archive.org requests. Be a good citizen.

**The app must never call archive.org at runtime.** Everything is read from `content/` and `public/`.

**GATE 3:** `content/pages.ts` has 20 entries, each with non-empty text; `public/pages/` has 20 jpg files; open one in a browser and confirm it is a readable scan.

---

## Step 4. Anchors

Create `content/anchors.ts` exporting `ANCHORS: Anchor[]`, about 60 Delhi landmarks the volume measures distances *from*: city gates, kotlas, dargahs, named villages, old roads, wells.

`precisionM` is the judgement call and it matters more than it looks, because it feeds straight into every Uncertainty Radius:

| Kind of anchor | precisionM | Why |
|---|---|---|
| A specific gate or single structure (Kashmiri Gate, Ajmeri Gate) | 40 to 80 | Pins a spot |
| A walled enclosure (Kotla Firoz Shah, Purana Qila) | 100 to 200 | Pins an area |
| A village or locality (Mehrauli, Nizamuddin) | 400 to 900 | Pins a neighbourhood |
| A road or a vague direction ("the old northern road") | 1200 to 2000 | Barely pins anything |

`aliases` carries the spellings the 1916 volume uses that no longer exist. Add them as you find them while reading pages. Match is case-insensitive across `name` and `aliases`.

Seed anchor, verified:

```ts
{ id: 'kotla-firoz-shah', name: 'Kotla Firoz Shah',
  aliases: ['Firozabad', 'Kotla', 'Feroz Shah Kotla'],
  centroid: [77.2432, 28.6383], precisionM: 120 }
```

**GATE 4:** every anchor centroid is inside `lng 76.8..77.4, lat 28.3..28.9`. Assert this in a test.

---

## Step 5. Spatial resolution (pure, TDD)

Create `lib/resolve.ts`:

```ts
export function resolveClue(
  clue: SpatialClue, anchors: Anchor[]
): { centroid: [number, number]; uncertaintyRadiusM: number } | null
```

Pure. No I/O, no `Date.now()`, no `Math.random()`. **Write the tests first.**

### Algorithm

1. **Match the anchor** against `name` and `aliases`, case-insensitive, trimmed. No match returns `null`. Do not fuzzy match, do not pick the nearest name, do not guess.

2. **Convert distance to metres:**

| Unit | Metres | Note |
|---|---|---|
| `feet` | 0.3048 | |
| `yards` | 0.9144 | |
| `miles` | 1609.34 | |
| `paces` | 0.76 | a pace, not a stride |
| `gaz` | 0.83 | varied regionally, this is the common Delhi value |
| `kos` | **2500** | see below |

**Kos is not a fixed length.** Around Delhi it ranged from roughly 1.8km to 3.2km. Use 2500m as the centre and widen the radius to span the whole range. This is deliberate: the honest output for a vague unit is a wide circle, not a precise pin.

3. **Non-directional bearings.** If `bearing` is `adjacent`, `within` or `opposite`, return the anchor's own centroid, with radius `anchor.precisionM + max(distanceM, 50)`. There is no direction to project along.

4. **Missing distance.** If `distanceValue` is null but a compass bearing exists, treat the distance as 150m and add 150 to the radius, because "to the north of X" implies nearby but unmeasured.

5. **Project** with turf. Compass degrees: `N=0, NE=45, E=90, SE=135, S=180, SW=225, W=270, NW=315`.

```ts
import { destination, point } from "@turf/turf";
const dest = destination(point(anchor.centroid), distanceM / 1000, bearingDeg, { units: "kilometers" });
const centroid = dest.geometry.coordinates as [number, number];
```

6. **Uncertainty radius:**

```
bearingErrorM  = distanceM * Math.sin(22.5 * Math.PI / 180)   // 8-point compass, +/- 22.5 deg
distanceErrorM = distanceM * unitVagueness[unit]
radius         = anchor.precisionM + bearingErrorM + distanceErrorM

unitVagueness = { feet: 0.10, yards: 0.15, paces: 0.25, gaz: 0.25, miles: 0.20, kos: 0.30 }
```

Round the radius to the nearest metre. **A coordinate is never returned without a radius.** Make that structurally impossible in the return type.

### Tests, `tests/resolve.test.ts`

```ts
test('200 yards north lands north of the anchor and barely moves east or west')
test('an unknown anchor returns null rather than a guess')
test('one kos produces a radius over 1000m')
test('adjacent returns the anchor centroid itself')
test('a null distance with a bearing still resolves, with a wider radius')
test('aliases match case-insensitively')
test('every returned coordinate carries a radius')
test('every returned coordinate is inside the Delhi bounds')
```

**GATE 5:** all eight tests green. Paste one returned coordinate into geojson.io and confirm it lands in Delhi.

---

## Step 6. Modern Baseline (pure, TDD)

Write `scripts/pull-baseline.ts` to run **once** and commit the result:

```
POST https://overpass-api.de/api/interpreter
body: data=
[out:json][timeout:60];
(node["historic"](28.40,76.84,28.88,77.35);
 way["historic"](28.40,76.84,28.88,77.35);
 node["heritage"](28.40,76.84,28.88,77.35);
 way["heritage"](28.40,76.84,28.88,77.35););
out center;
```

Note Overpass uses `(south,west,north,east)`, which is a different order again. Convert each element to `BaselineFeature` with `centroid: [lon, lat]` (ways carry `center.lon` / `center.lat`). Write `content/baseline.geojson` with the query in a header comment so it is reproducible. Skip unnamed features.

**Never call Overpass at runtime.**

Create `lib/baseline.ts`:

```ts
export function checkBaseline(
  centroid: [number, number], radiusM: number, baseline: BaselineFeature[]
): { id: string; name: string; distanceM: number } | null
```

Pure. Return the **nearest** feature whose great-circle distance from `centroid` is `<= radiusM`, or `null`. Use `turf.distance`.

A non-null result means the Candidate is `matched_existing`. A null result means a Representation Gap.

**`matched_existing` is not a failure.** It is the most persuasive output the pipeline produces, because it proves the system finds real things rather than manufacturing pins. Ensure at least one demo page yields one.

Tests: feature inside radius returns it; feature outside returns null; nearest wins when two are inside; empty baseline returns null.

**GATE 6:** tests green, `content/baseline.geojson` has more than 200 named features.

---

## Step 7. Confidence (pure, TDD)

Create `lib/confidence.ts`:

```ts
export function scoreConfidence(parts: ConfidenceParts): number
```

Weights, which sum to 1.0:

```
sourceReliability     0.30
clueSpecificity       0.25
anchorPrecision       0.20
crossSourceAgreement  0.15   // always 0 until a second Volume is ingested
modernEvidence        0.10
```

Return the weighted sum, clamped to `0..1`, rounded to 2 decimals.

How each part is computed for this Volume:

| Part | Value |
|---|---|
| `sourceReliability` | `0.90` fixed. An official ASI survey is a strong source. |
| `clueSpecificity` | `1.0` if bearing and distance are both present with a tight unit (feet, yards); `0.7` if the unit is vague (kos, gaz, paces); `0.4` if the bearing is non-directional; `0.0` if there is no Spatial Clue. |
| `anchorPrecision` | `clamp(1 - anchor.precisionM / 2000, 0, 1)` |
| `crossSourceAgreement` | `0` always, for now. |
| `modernEvidence` | `0.4` if a baseline feature sits inside the radius, `0.1` if none does. |

**Always return the parts alongside the total in the UI.** A single opaque number is worse than showing nothing. A judge asking "where does 0.71 come from" must get arithmetic, not a shrug.

**GATE 7:** tests green. All-zeros returns 0, all-ones returns 1.0, output never leaves `0..1`.

---

## Step 8. Extraction

Create `lib/extract.ts`:

```ts
export async function extractMentions(
  pageText: string, pageNo: number
): Promise<{ mentions: Mention[]; source: 'live' | 'cached' }>
```

### The zod schema

```ts
import { z } from "zod";

const SpatialClueSchema = z.object({
  anchorName: z.string(),
  bearing: z.enum(['N','NE','E','SE','S','SW','W','NW','adjacent','within','opposite']).nullable(),
  distanceValue: z.number().nullable(),
  distanceUnit: z.enum(['yards','feet','miles','kos','paces','gaz']).nullable(),
}).nullable();

const MentionSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['mosque','tomb','gateway','fort_wall','palace','pavilion','stepwell',
                'caravanserai','garden','bridge','well','temple','madrasa','hammam',
                'tower','other']),
  period: z.string().nullable(),
  passage: z.string().min(1),
  spatialClue: SpatialClueSchema,
});

export const ExtractionSchema = z.object({ mentions: z.array(MentionSchema) });
```

### The prompt

```
You are reading one page of "List of Muhammadan and Hindu Monuments, Delhi
Province" (Archaeological Survey of India, 1916). It is a catalogue of
structures in and around Delhi.

Extract every distinct structure the page describes.

Rules:
- Copy the "passage" VERBATIM from the text given. Do not paraphrase, do not fix
  spelling, do not correct OCR errors. It must appear character for character in
  the input, because it is used to locate the passage in the page.
- "anchorName" is the landmark the text measures FROM, written exactly as the
  text writes it. If the text names no landmark, spatialClue is null.
- Return null rather than guessing. "period": "probably Mughal" is wrong; return
  null. An uncertain field left null is correct; an invented one is not.
- Keep the original unit of distance. The text uses kos and gaz. Do NOT convert
  them to yards or metres.
- Bearings: use the eight compass tokens for directions. Use "adjacent" for
  adjoining or attached, "within" for inside or enclosed by, "opposite" for
  facing or across from.
- If the page is an index, a preface or a table of contents, return an empty
  mentions array.

Page text:
---
{PAGE_TEXT}
---
```

Call `gemini-3.7-flash` with `responseMimeType: "application/json"` and the schema. Validate with zod.

### Passage offsets

The model returns `passage` but not its position. Compute it:

```ts
const start = pageText.indexOf(m.passage);
```

If `start === -1` the model paraphrased despite instruction. **Drop that Mention and log it.** Do not fuzzy match, and do not keep a Mention whose passage cannot be located in the source; that breaks the evidence chain, which is the point of the whole project.

Assign ids as `m_{pageNo}_{n}` where n starts at 1 over surviving Mentions.

### Fallback, non-negotiable

Wrap the call in a `GEMINI_TIMEOUT_MS` timeout (8000ms default). On **any** failure, timeout, zod error or empty key, read `content/cache/page-{pageNo}.json` and return it with `source: 'cached'`. If no cache file exists either, throw a plain error the UI can render as unavailable. **Never fabricate a Mention.**

### Build the cache first

Write `scripts/build-cache.ts` to run extraction over all 20 pages and save each result to `content/cache/page-{N}.json`. **Run it and commit the output before building the screen.** A fallback written after the happy path is a fallback that has never run.

Gemini free tier is about **10 requests per minute**. Sleep 7 seconds between pages. Never parallelise.

**GATE 8:** `content/cache/` has 20 json files. Unset `GEMINI_API_KEY`, call `extractMentions`, and confirm it returns `source: 'cached'` without throwing.

---

## Step 9. The pipeline

Create `lib/pipeline.ts`:

```ts
export function buildCandidates(
  mentions: Mention[], anchors: Anchor[], baseline: BaselineFeature[]
): Candidate[]
```

Pure. For each Mention:

1. No `spatialClue` -> `centroid: null`, `uncertaintyRadiusM: null`, `status: 'extracted'`, confidence with `clueSpecificity: 0`.
2. `resolveClue` returns null (unknown anchor) -> same as above but `status: 'extracted'`. **This Mention is still returned.** It is displayed as unresolvable with its passage. It is never dropped and never given a coordinate.
3. Resolved -> set centroid and radius, then run `checkBaseline`.
   - Match found -> `status: 'matched_existing'`, `matchedBaselineFeature` populated, `modernEvidence: 0.4`.
   - No match -> `status: 'candidate'`, `matchedBaselineFeature: null`, `modernEvidence: 0.1`.

Candidate id is `c_{pageNo}_{n}`, matching its Mention's number.

**GATE 9:** a test asserting that a Mention with an unknown anchor produces a Candidate with `centroid === null` and is present in the output array.

---

## Step 10. The screen

`app/discover/page.tsx`. Three panes on desktop, stacked below 1024px.

```
+---------------------+----------------------+----------------------+
|  PAGE                |  MENTIONS            |  MAP                 |
|                      |                      |                      |
|  [scanned image]     |  RUINED SERAI        |     .--------.       |
|                      |  caravanserai        |    /          \      |
|  "...a ruined serai  |  Mughal              |   |     o      |     |
|   about 200 yards    |  200 yards N of      |    \          /      |
|   north of the old   |  Kotla Firoz Shah    |     '--------'       |
|   road stands..."    |  confidence 0.71     |                      |
|   ^^^^^^^^^^^^^^^    |  [see evidence]      |  radius 145m         |
|   highlighted        |                      |  not on today's map  |
+---------------------+----------------------+----------------------+
```

- A page picker at the top. An **Analyse** button.
- Mentions appear **one at a time**, roughly 900ms apart, not all at once.
- As each appears, highlight its passage in the left pane using `passageOffset`.
- On the map: draw the uncertainty circle, **contract it** to its final radius over about 600ms, then drop the pin. Use `turf.circle` for the polygon and `toLeaflet` when handing coordinates to Leaflet.
- The baseline verdict appears last.
- Unresolvable Mentions appear in the centre pane, clearly marked, **with no pin**.

The staging is not decoration. It makes an invisible process legible in eight seconds. Aim for 10 to 20 seconds total. Instant results look pre-baked.

Leaflet touches `window` at module scope, so:

```tsx
const Map = dynamic(() => import("@/components/DiscoverMap"), { ssr: false });
```

### The Evidence panel

Opens from any Mention or Candidate, in one interaction. It shows:

- the exact passage, and which Volume and page
- the anchor used, with the bearing and distance **as the text originally wrote them**
- the resolved coordinate and radius in metres
- which baseline features were checked and what was or was not found
- the confidence broken into its five parts with weights and products, and the total

**Nothing on screen may lack a route to this panel.** Enforce it by making the component require an `onShowEvidence` handler.

### States

`loading` a hairline shimmer, no spinners. `cached` a small mono chip beside the result naming the source. `partial` resolved Mentions render, unresolvable ones are named inline. `error` plain text and a retry, never a raw message or a stack trace.

`cached` is not an error state. It is an honest label on a working path, and it is a stronger position than a disguised one.

**GATE 10:** pick a page never demoed, hit Analyse, watch it resolve. Then turn off wifi and repeat: it must still resolve, labelled `cached`.

---

## Step 11. Verify

Create `scripts/verify.ts` and make every assertion pass:

```ts
import { resolveClue } from "../lib/resolve";
import { scoreConfidence } from "../lib/confidence";
import { toLeaflet } from "../lib/geo";
import { ANCHORS } from "../content/anchors";
import { PAGES } from "../content/pages";
import fs from "fs";

const clue = { anchorName: 'Kotla Firoz Shah', bearing: 'N' as const,
               distanceValue: 200, distanceUnit: 'yards' as const };
const r = resolveClue(clue, ANCHORS)!;

console.assert(r.centroid[0] > 76.8 && r.centroid[0] < 77.4, 'first element must be LONGITUDE');
console.assert(r.centroid[1] > 28.3 && r.centroid[1] < 28.9, 'second element must be LATITUDE');
console.assert(r.centroid[1] > 28.6383, 'north must increase latitude');
console.assert(typeof r.uncertaintyRadiusM === 'number' && r.uncertaintyRadiusM > 0);

console.assert(resolveClue({ ...clue, anchorName: 'a place that does not exist' }, ANCHORS) === null,
  'an unknown anchor must return null, never a guess');

console.assert(toLeaflet([77.2410, 28.6562])[0] === 28.6562, 'toLeaflet must output [lat, lng]');

for (const a of ANCHORS) {
  console.assert(a.centroid[0] > 76.8 && a.centroid[0] < 77.4, `${a.id}: lng out of Delhi`);
  console.assert(a.centroid[1] > 28.3 && a.centroid[1] < 28.9, `${a.id}: lat out of Delhi`);
  console.assert(a.precisionM > 0, `${a.id}: precisionM must be set`);
}

console.assert(ANCHORS.length >= 40, 'need about 60 anchors');
console.assert(PAGES.length === 20, 'need 20 ingested pages');
for (const p of PAGES) {
  console.assert(p.text.trim().length > 200, `page ${p.pageNo}: text too short`);
  console.assert(fs.existsSync(`public/pages/n${p.pageNo}.jpg`), `page ${p.pageNo}: scan missing`);
  console.assert(fs.existsSync(`content/cache/page-${p.pageNo}.json`), `page ${p.pageNo}: no cache`);
}

console.assert(scoreConfidence({ sourceReliability:0, clueSpecificity:0, anchorPrecision:0,
  crossSourceAgreement:0, modernEvidence:0 }) === 0);
console.assert(scoreConfidence({ sourceReliability:1, clueSpecificity:1, anchorPrecision:1,
  crossSourceAgreement:1, modernEvidence:1 }) <= 1.0001);

console.log("verify: all assertions passed");
```

Then:

```bash
pnpm verify && pnpm test && pnpm typecheck && pnpm build
grep -rn "—\|–" lib/ app/ content/ components/    # must print nothing
```

---

## Do not build

Each of these is a real trap, and an agent will reach for several of them unprompted.

- **File upload of any kind.** Not PDF, not image. Pages come from the committed set. An upload box is an unbounded input that breaks on stage.
- **Live archive.org or Overpass calls.** Both are ingest-time only.
- **A geocoding API** (Nominatim, Google, Mapbox). The curated anchor table is deliberate. A live geocoder will resolve "Kotla" to somewhere in Kanpur.
- **Parallel or batched Gemini calls.** Free tier is about 10 per minute.
- **Fuzzy anchor matching.** Exact match on name or alias, case-insensitive. Nothing cleverer.
- **A database.** Everything is committed JSON read at build time.
- **PostGIS or a spatial index.** In-memory turf over a few hundred features.
- **An abstraction with one caller.** No provider interface for one model, no repository pattern, no service layer.
- **Retry loops with exponential backoff.** One attempt, then the cache. That is the whole error strategy.
- **Converting kos to a precise number and hiding the vagueness.** The vagueness is the honest part.

---

## Submit

Your work goes into `contrib/` in the team repo, which is excluded from the build and cannot break anything.

```bash
gh repo fork https://github.com/RAK2315/sih26-team-sigmoid --clone
cd sih26-team-sigmoid
git checkout -b brief-1-discovery-shantanu
mkdir -p contrib/brief-1-discovery-shantanu
cp -r <your-app>/{app,lib,content,scripts,tests,public,package.json,tsconfig.json,vitest.config.ts} \
      contrib/brief-1-discovery-shantanu/
git add contrib/
git diff --staged | grep -iE "api[_-]?key|secret|token|password"   # must print nothing
git commit -m "contrib: discovery engine (brief 1)"
git push -u origin brief-1-discovery-shantanu
gh pr create --fill
```

Every file in the diff must sit under `contrib/brief-1-discovery-shantanu/`. No `.env`, no key, no `node_modules/`, no `.next/`, nothing over 5MB.

PR description:

```
## Brief 1 - Discovery engine

Works:
- ...

Does not work yet:
- ...

Run it:
cd contrib/brief-1-discovery-shantanu && pnpm install && pnpm dev

Verify output:
<paste the output of pnpm verify>
```

Say plainly what does not work. It will not count against you, and it is more useful than a PR that pretends.

Link a 60 second recording of one page resolving end to end. Link it, do not commit the video.
