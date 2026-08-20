# BRIEF 1 - The Discovery Engine

**Owner:** one person. **Time:** 2-3 days. **Difficulty:** highest of the five.

Build this standalone. You do not need the main repo and you will not touch its code.

> **Using an AI coding agent?** Read [BRIEF-1-AGENT-SPEC.md](./BRIEF-1-AGENT-SPEC.md) alongside this. It is the executable version: exact files, exact signatures, the full extraction prompt, and a verification gate after every step. This file explains the why; that one is what you hand the agent.

---

## 1. What you are building

A screen that takes one page of a real 1919 archaeological survey and turns it into pins on a modern map.

The Archaeological Survey of India published a monument by monument survey of Delhi between 1916 and 1922. It records roughly 1,300 structures. Each entry describes what the structure is and, in period prose, where it stands: *"a ruined serai about 200 yards north of the old road"*. Today only about 174 Delhi monuments are centrally protected. The rest are in that book and nowhere else.

Your screen reads a page, pulls out each structure mentioned, converts its written location into a coordinate with an honest uncertainty radius, and checks whether anything on today's map sits inside that radius. If nothing does, you have found a Representation Gap: something the record knew about that no modern map shows.

**You are not building "AI finds lost monuments".** You are building a pipeline that produces **Candidates for a human to review**. That distinction is the whole credibility of the project. Read section 9.

---

## 2. Setup

```bash
npx create-next-app@16.3.1 discovery --ts --tailwind --app --no-src-dir
cd discovery
pnpm add @google/genai@2.17.1 @turf/turf@7.4.0 zod@4.4.3 leaflet@1.9.4 react-leaflet@5.0.0
pnpm add -D vitest@4.1.11 @types/leaflet
```

Get a free Gemini API key at aistudio.google.com. Put it in `.env.local` as `GEMINI_API_KEY`. **Free tier is about 10 requests per minute, so never call it in a loop or in parallel.**

Get your source pages:

Use **Volume 2 (1919)**, not Volume 1. Volume 1 covers the walled city and locates a structure by naming the muhalla it stands in, so it holds one bearing-and-distance clue in 231 pages. Volume 2 covers the outlying areas, where the surveyor had to measure, and holds 213 across 127 pages. Those measured clues are the whole input to your resolver.

```bash
# per-page text. use the XML, not _djvu.txt
curl -o vol2.xml "https://archive.org/download/in.ernet.dli.2015.69530/2015.69530.List-Of-Muhammadan-And-Hindu-Monuments-Vol2_djvu.xml"

# a page image (n58 = the 59th scanned image, 0-indexed)
curl -o public/pages/n58.jpg "https://archive.org/download/in.ernet.dli.2015.69530/page/n58_w800.jpg"
```

**`_djvu.txt` has no page separators**, so you cannot slice it per page. `_djvu.xml` has one `<OBJECT>` per scanned page in image order, and its `usemap="..._0058.djvu"` number is the same N as the image URL. Join the `<WORD>` contents inside each `<LINE>` to rebuild a page.

This is what a page of Volume 2 actually gives you:

```
No. 52. (a) Mosque (nameless).
(b) Some 170 yards to the east of No. 51.
```

The `(b)` field is the Spatial Clue. Note that many of them measure from another numbered entry rather than a named landmark, so they resolve against no Anchor and must be shown as unresolvable with their passage.

Download about 20 pages once and commit them. **Never fetch archive.org at runtime.**

---

## 3. Types

Copy this file verbatim as `lib/types.ts`. Do not rename anything, do not change a type, do not add fields.

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
  anchorName: string;            // as written in the book, eg "Kotla Firoz Shah"
  bearing: BearingToken | null;
  distanceValue: number | null;
  distanceUnit: DistanceUnit | null;
}

export interface Mention {
  id: string;                    // "m_87_1" = page 87, first mention
  name: string;
  type: StructureType;
  period: string | null;         // "Mughal", "Tughlaq", "Lodi", null if unstated
  passage: string;               // the exact sentence from the page
  passageOffset: [number, number]; // char range into the page text, for highlighting
  spatialClue: SpatialClue | null;
}

export interface ConfidenceParts {
  sourceReliability: number;     // 0..1
  clueSpecificity: number;       // 0..1
  anchorPrecision: number;       // 0..1
  crossSourceAgreement: number;  // always 0 for now, reserved
  modernEvidence: number;        // 0..1
}

export interface Candidate {
  id: string;                    // "c_87_1", matches its Mention
  mentionId: string;
  centroid: [number, number] | null;   // [lng, lat] GeoJSON order. null = unresolvable
  uncertaintyRadiusM: number | null;
  status: CandidateStatus;
  matchedBaselineFeature: { id: string; name: string; distanceM: number } | null;
  confidence: { total: number; parts: ConfidenceParts };
}

export interface Anchor {
  id: string;
  name: string;
  aliases: string[];             // old spellings found in the book
  centroid: [number, number];    // [lng, lat]
  precisionM: number;            // how tightly this name pins a spot
}
```

**The coordinate order trap.** GeoJSON and turf use `[lng, lat]`. Leaflet uses `[lat, lng]`. They are backwards from each other. Store everything as `[lng, lat]` and flip only when handing to Leaflet, in one helper function, nowhere else. If your pins land in the Arabian Sea, this is why.

---

## 4. What to build

### 4.1 Extraction - `lib/extract.ts`

```ts
export async function extractMentions(pageText: string, pageNo: number): Promise<Mention[]>
```

Send the page text to Gemini (`gemini-3.7-flash`) with a zod schema and ask for structured JSON. Validate the response with zod. If validation fails, throw. If the call fails or takes more than 8 seconds, read `content/cache/page-{pageNo}.json` and return that instead.

**Build the cache before you build the screen.** Write a script that runs extraction over all 20 pages once and saves each result. The cache is what makes the demo survive bad wifi. A fallback written after the happy path is a fallback that has never run.

Prompt notes that will save you hours:
- Tell the model to return the passage **verbatim** so you can find its offset with `indexOf`.
- Tell it to return `null` rather than guess. Models want to fill fields. `"period": "probably Mughal"` is worse than `null`.
- The book uses **kos** and **gaz**. Do not let the model convert them. Keep the original unit.

### 4.2 Anchors - `content/anchors.ts`

About 60 Delhi landmarks that the book measures distances from: city gates, kotlas, dargahs, named villages, old roads. Each needs a coordinate and a `precisionM`.

`precisionM` is the interesting part. "Kashmiri Gate" pins a spot to about 50m. "the old northern road" does not pin a spot at all, so it might be 1500m. This number flows straight into the uncertainty radius, so guessing it badly makes the whole map wrong.

`aliases` matters because the book uses spellings that no longer exist. Record them as you hit them.

### 4.3 Resolution - `lib/resolve.ts` (pure, test this)

```ts
export function resolveClue(clue: SpatialClue, anchors: Anchor[]):
  { centroid: [number, number]; uncertaintyRadiusM: number } | null
```

1. Match `clue.anchorName` against anchor names and aliases, case-insensitive. No match returns `null`. **Do not guess a location.** An unresolvable mention displayed honestly is worth more than a confident wrong pin.
2. Convert distance to metres. 1 yard = 0.9144m, 1 foot = 0.3048m, 1 mile = 1609.34m, 1 gaz is roughly 0.83m, 1 pace is roughly 0.76m.
3. **Kos is not a fixed length.** Around Delhi it ranges from about 1.8km to 3.2km. Use 2.5km as the centre and make the radius wide enough to cover the whole range. This is the single most interesting case in the whole task.
4. Project with `turf.destination(anchorPoint, distanceKm, bearingDegrees)`. Bearings: N=0, NE=45, E=90, SE=135, S=180, SW=225, W=270, NW=315.
5. Radius = `anchor.precisionM + bearingError + distanceError` where `bearingError` is roughly `distance * sin(22.5 degrees)` because an eight point compass is only accurate to plus or minus 22.5 degrees, and `distanceError` scales with how vague the unit is (yards tight, kos very wide).
6. `adjacent` / `within` / `opposite` bearings mean no direction. Return the anchor's own position with a radius covering the stated distance in every direction.

### 4.4 Baseline check - `lib/baseline.ts` (pure, test this)

Pull today's map data once:

```bash
curl -G https://overpass-api.de/api/interpreter --data-urlencode 'data=
[out:json][timeout:60];
(node["historic"](28.40,76.84,28.88,77.35);
 way["historic"](28.40,76.84,28.88,77.35);
 node["heritage"](28.40,76.84,28.88,77.35);
 way["heritage"](28.40,76.84,28.88,77.35););
out center;' -o baseline.json
```

Convert to GeoJSON, commit as `content/baseline.geojson`, **never call Overpass at runtime**.

```ts
export function checkBaseline(
  centroid: [number, number], radiusM: number, baseline: GeoJSON.FeatureCollection
): { id: string; name: string; distanceM: number } | null
```

Nearest feature inside the radius, or null. If it returns something, the candidate is `matched_existing`. If it returns null, that is a Representation Gap.

**`matched_existing` is not a failure case, it is your most persuasive result.** It proves the pipeline is finding real things rather than producing pins. Make sure at least one page in your demo set produces one.

### 4.5 Confidence - `lib/confidence.ts` (pure, test this)

```ts
export function scoreConfidence(parts: ConfidenceParts): number
```

Weighted sum: sourceReliability 0.30, clueSpecificity 0.25, anchorPrecision 0.20, crossSourceAgreement 0.15, modernEvidence 0.10.

**Always return the parts alongside the total.** A judge asking "where does 0.71 come from" must get a breakdown, not a shrug. A single opaque number is worse than no number.

### 4.6 The screen - `app/discover/page.tsx`

Three panes.

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

A page picker at the top. An "Analyse" button. When it runs:
1. Mentions appear one at a time, not all at once.
2. As each appears, its passage highlights in the page text on the left.
3. The uncertainty circle draws on the map, then **contracts** as constraints apply, then the pin drops.
4. The baseline verdict appears last.

The animation is not decoration. It is what makes an invisible process legible in eight seconds. Take about 10-20 seconds total. Instant results look pre-baked.

An **Evidence panel** opens from any candidate showing: the page image, the exact passage, which anchor was used, the projection arithmetic, which baseline features were checked, and the confidence broken into its five named parts. Nothing on screen may lack a route to this panel.

---

## 5. Fixture to build against

Do not wait for Gemini to work before building the screen. Hardcode this and build the UI first.

```ts
export const FIXTURE_MENTIONS: Mention[] = [
  { id: 'm_87_1', name: 'Ruined serai', type: 'caravanserai', period: 'Mughal',
    passage: 'a ruined serai about 200 yards north of the old road',
    passageOffset: [1204, 1256],
    spatialClue: { anchorName: 'Kotla Firoz Shah', bearing: 'N',
                   distanceValue: 200, distanceUnit: 'yards' } },
  { id: 'm_87_2', name: 'Small mosque', type: 'mosque', period: null,
    passage: 'a small mosque adjoining the eastern wall',
    passageOffset: [1400, 1440],
    spatialClue: { anchorName: 'Kotla Firoz Shah', bearing: 'adjacent',
                   distanceValue: null, distanceUnit: null } },
  { id: 'm_87_3', name: 'Old well', type: 'well', period: 'Lodi',
    passage: 'an old well half a kos to the westward',
    passageOffset: [1600, 1638],
    spatialClue: { anchorName: 'the old northern road', bearing: 'W',
                   distanceValue: 0.5, distanceUnit: 'kos' } },
];

export const FIXTURE_ANCHORS: Anchor[] = [
  { id: 'kotla-firoz-shah', name: 'Kotla Firoz Shah',
    aliases: ['Firozabad', 'Kotla'], centroid: [77.2432, 28.6383], precisionM: 120 },
];
```

Note what this fixture forces you to handle: `m_87_2` has no distance, and `m_87_3`'s anchor is not in the table so it must come back unresolvable. Both are the interesting cases.

---

## 6. How to test

Five tests in `tests/resolve.test.ts`, run with `pnpm vitest`:

```ts
test('200 yards north lands about 183m north of the anchor', () => {
  const r = resolveClue(FIXTURE_MENTIONS[0].spatialClue!, FIXTURE_ANCHORS)!;
  expect(r.centroid[1]).toBeGreaterThan(28.6383);        // moved north
  expect(r.centroid[0]).toBeCloseTo(77.2432, 3);         // barely moved east/west
});

test('unknown anchor returns null, never a guess', () => {
  expect(resolveClue(FIXTURE_MENTIONS[2].spatialClue!, FIXTURE_ANCHORS)).toBeNull();
});

test('a kos produces a radius over 1km', () => {
  const clue = { anchorName: 'Kotla Firoz Shah', bearing: 'W' as const,
                 distanceValue: 1, distanceUnit: 'kos' as const };
  expect(resolveClue(clue, FIXTURE_ANCHORS)!.uncertaintyRadiusM).toBeGreaterThan(1000);
});

test('adjacent returns the anchor position itself', () => { /* ... */ });
test('a coordinate always comes with a radius', () => { /* ... */ });
```

That last one matters. **A coordinate without an uncertainty radius is a lie.** Make it structurally impossible to return one.

Also test `checkBaseline` (feature inside radius returns it, feature outside returns null) and `scoreConfidence` (weights sum to 1.0, output stays in 0..1).

Manual checks before you hand it over:
- Turn wifi off, hit Analyse. Does the cached result appear with a visible "cached" label?
- Pick a page you have never demoed. Does it still work?
- Paste one of your output coordinates into geojson.io. Is it in Delhi?

---

## 7. Verify your build

Write these four files and make each check pass. Add it as `scripts/verify.ts` and run `pnpm tsx scripts/verify.ts` before you submit.

**Files you must have produced:**

```
lib/types.ts                  copied verbatim from section 3
lib/extract.ts                extractMentions(pageText, pageNo)
lib/resolve.ts                resolveClue(clue, anchors)
lib/baseline.ts               checkBaseline(centroid, radiusM, baseline)
lib/confidence.ts             scoreConfidence(parts)
content/anchors.ts            about 60 Delhi anchors
content/baseline.geojson      committed Overpass snapshot
content/cache/page-*.json     one cached extraction per page
public/pages/*.jpg            about 20 committed page images
app/discover/page.tsx         the three-pane screen
tests/resolve.test.ts         the tests in section 6
```

**Checks that must pass:**

```ts
import { resolveClue } from '../lib/resolve';
import { scoreConfidence } from '../lib/confidence';
import { FIXTURE_MENTIONS, FIXTURE_ANCHORS } from '../content/fixtures';

const r = resolveClue(FIXTURE_MENTIONS[0].spatialClue!, FIXTURE_ANCHORS)!;

// coordinates are [lng, lat], so the first element is the big one in Delhi
console.assert(r.centroid[0] > 76.8 && r.centroid[0] < 77.4, 'first element must be LONGITUDE');
console.assert(r.centroid[1] > 28.3 && r.centroid[1] < 28.9, 'second element must be LATITUDE');

// a coordinate always comes with a radius
console.assert(typeof r.uncertaintyRadiusM === 'number' && r.uncertaintyRadiusM > 0);

// an unknown anchor is never guessed at
console.assert(resolveClue(FIXTURE_MENTIONS[2].spatialClue!, FIXTURE_ANCHORS) === null);

// confidence stays in range
console.assert(scoreConfidence({ sourceReliability:1, clueSpecificity:1, anchorPrecision:1,
  crossSourceAgreement:1, modernEvidence:1 }) <= 1.0001);
console.assert(scoreConfidence({ sourceReliability:0, clueSpecificity:0, anchorPrecision:0,
  crossSourceAgreement:0, modernEvidence:0 }) === 0);
```

Also run and fix:

```bash
pnpm vitest run        # all tests green
pnpm tsc --noEmit      # no type errors
pnpm build             # production build succeeds
```

---

## 8. What NOT to do

- **No file upload.** Not PDF, not image, not anything. Pages come from your committed set. An upload box is an unbounded input that will break on stage.
- **No live Overpass or archive.org calls.** Both are ingest-time only.
- **No parallel Gemini calls.** Free tier is about 10 per minute. One page at a time.
- **Never place an unresolvable mention at a guessed coordinate.** Show it as unresolvable with its passage.
- **No PostGIS, no database.** Everything is in-memory turf over committed JSON.
- **No abstraction with one caller.** No provider layer, no strategy pattern, no config system.
- Do not convert kos to a precise number and hide the uncertainty. The uncertainty is the honest part.

---

## 9. The thing that matters more than the code

A judge will ask: **"How do you know the AI isn't making these up?"**

Your answer has to be built into the screen, not improvised. It is:

1. Every claim traces to a page image and an exact passage they can read themselves.
2. Every coordinate carries an uncertainty radius, visible on the map.
3. Confidence is five named components with weights, not one opaque number.
4. Nothing automated goes past `candidate`. A human moves it further, or it stays there forever.
5. Some candidates come back `matched_existing`, which proves the pipeline finds real things.

Build the screen so that all five are visible without you saying a word. That is the difference between a project that survives the question and one that does not.

---

## 10. How to submit

Your work goes into the main repo under `contrib/`, where it is excluded from the build and cannot break anything. Every PR that follows these steps gets merged.

```bash
# 1. fork and clone the main repo
gh repo fork https://github.com/RAK2315/sih26-team-sigmoid --clone
cd sih26-team-sigmoid

# 2. branch
git checkout -b brief-1-discovery-<yourname>

# 3. copy your standalone app in
mkdir -p contrib/brief-1-discovery-<yourname>
cp -r <your-app>/{app,lib,content,scripts,tests,public,package.json,tsconfig.json} \
      contrib/brief-1-discovery-<yourname>/

# 4. check you are not committing anything you should not
git add contrib/
git diff --staged --stat
git diff --staged | grep -iE "api[_-]?key|secret|token|password"   # must print nothing

git commit -m "contrib: discovery engine (brief 1)"
git push -u origin brief-1-discovery-<yourname>
gh pr create --fill
```

**What decides whether it merges:**

- Every file in the diff sits under `contrib/brief-1-discovery-<yourname>/`. Nothing outside it, ever. Not the root `package.json`, not `tsconfig.json`, not CI config.
- No `.env` file, no API key, no credential anywhere in the diff.
- No `node_modules/`, no `.next/`, no audio or video files over 5MB.

Nothing else is grounds for rejection. Code style, architecture and whether the feature ends up being used are not your problem.

**PR description - copy this:**

```
## Brief 1 - Discovery engine

Works:
- ...

Does not work yet:
- ...

Run it:
cd contrib/brief-1-discovery-<yourname> && pnpm install && pnpm dev

Verify output:
<paste the output of pnpm tsx scripts/verify.ts>
```

Be straight in "does not work yet". A PR that says what is broken is more useful than one that pretends, and it will not count against you.

