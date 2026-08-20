# BRIEF 5 - Explore, Hidden Heritage and the Front Door

**Owner:** one person. **Time:** 1.5-2 days. **Difficulty:** medium. Most visual design of the five.

Build this standalone. You do not need the main repo and you will not touch its code.

---

## 1. What you are building

The first thing a judge sees, and the screen that connects the two halves of the project.

Three pieces: a landing page that says what this is in one breath, a Delhi-wide map of heritage sites, and a Hidden Heritage panel that surfaces the places almost nobody visits and says why they are worth it.

That last one is the bridge. One half of our project reads century-old survey documents and surfaces monuments missing from today's maps. The other half walks a visitor around a site and lets each structure speak. **Your panel is where those two meet.** Without it we have two products in one demo. With it we have one system, and the sentence "this place is on your map because we found it in a 1919 survey an hour ago" becomes possible.

You also own the visual identity. If this looks like every other hackathon dashboard, the project loses something it cannot get back.

---

## 2. Setup

```bash
npx create-next-app@16.3.1 explore --ts --tailwind --app --no-src-dir
cd explore
pnpm add leaflet@1.9.4 react-leaflet@5.0.0 @turf/turf@7.4.0
pnpm add -D vitest@4.1.11 @types/leaflet
```

---

## 3. Types

Copy verbatim as `lib/types.ts`.

```ts
export type SiteDepth = 'deep' | 'shallow';

export type CandidateStatus =
  | 'extracted' | 'geo_resolved' | 'candidate'
  | 'under_review' | 'verified' | 'rejected' | 'matched_existing';

export interface HeritageSite {
  id: string;                    // 'red-fort'
  name: string;
  nameLocal?: string;            // Devanagari
  depth: SiteDepth;
  period: string;
  centroid: [number, number];    // [lng, lat] GeoJSON order
  bbox: [number, number, number, number];  // [west, south, east, north]
  pointIds: string[];
  blurb: string;                 // one sentence
  representationScore: number;   // 0..1, LOW means under-represented
}

export interface HiddenEntry {
  id: string;
  name: string;
  distanceM: number;
  representationScore: number;
  evidence: string;              // "Zafar Hasan Vol. 2, p. 40 - not in the modern baseline"
  origin: 'site' | 'candidate';  // did this come from our seed data or the pipeline?
  status?: CandidateStatus;      // only when origin === 'candidate'
  centroid: [number, number];    // [lng, lat]
}
```

**The coordinate order trap.** GeoJSON and turf use `[lng, lat]`. Leaflet uses `[lat, lng]`. They are backwards. Store `[lng, lat]` everywhere and flip only in one helper when handing to Leaflet:

```ts
export const toLeaflet = (c: [number, number]): [number, number] => [c[1], c[0]];
```

That function is the only place the flip is allowed to happen. If your pins land in Somalia, this is why.

---

## 4. The look - read this before writing any CSS

The aesthetic is **archival India**. Aged paper, survey ink, hairline rules, restrained type. Think a colonial-era gazetteer, a Survey of India sheet, an ASI monument plate.

**Not**: neon gradients, glassmorphism, floating cards with soft shadows, a 3D globe, dark mode, decorative animation. Those are the default look of an AI-generated site and a judge has seen forty of them today.

Tokens. Put these in `app/globals.css` inside Tailwind v4's `@theme` and **never write a hex value anywhere else**:

```css
@import "tailwindcss";

@theme {
  --color-paper:        #F4EDE0;
  --color-paper-raised: #FAF6EE;
  --color-paper-sunk:   #EAE0CE;

  --color-ink:          #1F1B16;
  --color-ink-muted:    #5B5245;
  --color-ink-faint:    #9A8F7C;

  --color-madder:       #9A3412;   /* the accent - active state, route line */
  --color-indigo:       #1E3A5F;   /* archival context - documents, evidence */
  --color-verdigris:    #3F6B5E;   /* verified */

  --color-state-candidate: #B45309;
  --color-state-review:    #1E3A5F;
  --color-state-verified:  #3F6B5E;
  --color-state-rejected:  #8A8175;
  --color-state-matched:   #6B21A8;

  --font-display: "Cormorant Garamond", Georgia, serif;
  --font-ui:      "IBM Plex Sans", system-ui, sans-serif;
  --font-archive: "IBM Plex Mono", ui-monospace, monospace;

  --radius-sm: 2px;
  --radius-md: 3px;
  --shadow-paper: 0 1px 0 rgba(31,27,22,.08), 0 0 0 1px rgba(31,27,22,.06);
}
```

Three details that carry most of the effect:

**Radii are 2 to 3px and shadows are nearly flat.** Paper has crisp edges. A 12px radius with a soft drop shadow is the single strongest signal of a generic web app, and removing it costs nothing.

**Paper grain.** One tiled SVG `feTurbulence` at about 3 percent opacity, fixed on `body`. It is what makes the paper read as paper rather than as beige. It must not scroll with content.

**Mono is doing semantic work.** Use `--font-archive` only for text that came from the record: passages, page references, spatial clues. If it is monospaced, it came from a document. That rule is worth keeping.

**The map.** CARTO Positron tiles, no API key needed:

```
https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png
```

Then one line turns a modern basemap into aged paper:

```css
.leaflet-tile-pane { filter: sepia(.38) saturate(.75) contrast(1.06); }
```

Apply it to `.leaflet-tile-pane` only, not the whole map, or your markers and polygons get filtered too and everything goes muddy.

Attribution is required: `© OpenStreetMap contributors © CARTO`.

---

## 5. What to build

### 5.1 Landing - `app/page.tsx`

One screen. The name, one sentence, two doors.

The project is called **THRESHOLD** - *cross it, and the place speaks*. The logo is a bare pointed arch outline. That arch is the motif: it frames the primary surface on every screen. One shape, whole app.

The one sentence, which is also the pitch:

> The Archaeological Survey catalogued about 1,300 monuments in Delhi between 1916 and 1922. About 174 are centrally protected today. The rest did not all disappear - they stopped being findable.

Two doors: **Explore heritage** and **The archive**.

Do not put a feature grid on this page. Do not put three cards with icons. It is a title card.

### 5.2 The Delhi map - `app/explore/page.tsx`

Full-viewport map, 11 Heritage Sites as pins. Content in an overlay panel: a right rail at 1024px and up, a bottom sheet below that. **The map is never boxed inside a card.**

Pin design carries meaning:
- **Deep sites** (Red Fort, Qutub, Humayun's Tomb) get a larger, filled marker
- **Shallow sites** get a smaller outlined one
- **Sites from the pipeline** get the status colour from the token list

Clicking a pin opens a card: name, `nameLocal` in Devanagari, period, how many Heritage Points, the blurb, and a Begin action.

`MapContainer` must be dynamically imported with `ssr: false`. Leaflet touches `window` at module scope and will break the Next build otherwise:

```tsx
const Map = dynamic(() => import('@/components/Map'), { ssr: false });
```

### 5.3 Hidden Heritage - the bridge

A panel listing nearby places almost nobody visits, sorted by:

```ts
hiddenScore = (1 - representationScore) * proximityWeight
proximityWeight = 1 / (1 + distanceM / 2000)
```

Low representation and close by ranks highest. Under-represented but 30km away should not beat a stepwell 400m from where you are standing.

Each entry shows name, distance, and **its evidence line**. That last part is not optional:

```
  RUINED SERAI                                   1.2 km
  Recorded in Zafar Hasan Vol. 2, p. 40
  Not present in the modern baseline
  [ candidate ]
```

An entry with `origin: 'candidate'` is one the pipeline surfaced. Mark those visibly - they are the proof the two halves connect. **At least one entry in your demo data must be one.**

### 5.4 Attributions - `app/attributions/page.tsx`

Every image, document and dataset with author, source, licence and what the licence requires. Archive.org volumes, Wikimedia images, OpenStreetMap, CARTO.

This sounds like paperwork. At a heritage judging panel, "where did your images come from and are you allowed to use them" is a plausible question, and having the page ready turns it from a risk into a point scored.

### 5.5 Component states

Every data surface handles all seven. Naming them is what stops this shipping happy-path only.

| State | Looks like |
|---|---|
| loading | hairline shimmer on paper, no spinners |
| empty | one sentence saying what would appear and why it has not |
| error | plain ink text and a retry, never a raw message |
| **stale** | renders normally with a small mono `stale` chip naming the source |
| **partial** | shows what resolved, names what did not, inline |
| offline | banner: what still works, what does not |
| **cached** | mono `cached` chip beside the result |

`stale` and `cached` are **not error states**. They are honest labels on a working path. If a judge asks whether it is live, the answer is already on the screen. A labelled fallback beats a hidden one every time.

If tiles fail to load, the map keeps working - paper-coloured background, all geometry still drawn. Test this by blocking `basemaps.cartocdn.com` in devtools.

---

## 6. Fixture to build against

Coordinates are approximate and unverified. Fine for building; do not present them as surveyed.

```ts
export const SITES: HeritageSite[] = [
  { id:'red-fort', name:'Red Fort', nameLocal:'लाल क़िला', depth:'deep',
    period:'Mughal, 1638-1648', centroid:[77.2410,28.6562],
    bbox:[77.2370,28.6535,77.2445,28.6590], pointIds:new Array(11).fill(''),
    blurb:'Shah Jahan\'s citadel at the heart of Shahjahanabad.',
    representationScore:0.98 },
  { id:'qutub-complex', name:'Qutub Complex', nameLocal:'क़ुतुब मीनार', depth:'deep',
    period:'Slave dynasty onward, from 1192', centroid:[77.1855,28.5245],
    bbox:[77.1830,28.5225,77.1880,28.5265], pointIds:new Array(8).fill(''),
    blurb:'The first monuments of Islamic Delhi, built over an older temple site.',
    representationScore:0.97 },
  { id:'humayuns-tomb', name:"Humayun's Tomb", depth:'deep',
    period:'Mughal, 1565-1572', centroid:[77.2507,28.5933],
    bbox:[77.2480,28.5910,77.2535,28.5960], pointIds:new Array(8).fill(''),
    blurb:'The garden tomb that set the pattern the Taj Mahal would follow.',
    representationScore:0.95 },
  { id:'agrasen-ki-baoli', name:'Agrasen ki Baoli', depth:'shallow',
    period:'uncertain, rebuilt 14th c.', centroid:[77.2250,28.6265],
    bbox:[77.2245,28.6260,77.2255,28.6270], pointIds:[''],
    blurb:'A stepwell sunk between office towers off Hailey Road.',
    representationScore:0.55 },
  { id:'bhuli-bhatiyari', name:'Bhuli Bhatiyari ka Mahal', depth:'shallow',
    period:'Tughlaq, 14th c.', centroid:[77.1990,28.6395],
    bbox:[77.1985,28.6390,77.1995,28.6400], pointIds:[''],
    blurb:'A hunting lodge in the central ridge forest, rarely visited.',
    representationScore:0.18 },
  { id:'satpula', name:'Satpula', depth:'shallow',
    period:'Tughlaq, c. 1343', centroid:[77.2200,28.5350],
    bbox:[77.2195,28.5345,77.2205,28.5355], pointIds:[''],
    blurb:'A seven-arched water dam built into the walls of Jahanpanah.',
    representationScore:0.12 },
  { id:'lal-gumbad', name:'Lal Gumbad', depth:'shallow',
    period:'Tughlaq, c. 1397', centroid:[77.2180,28.5335],
    bbox:[77.2175,28.5330,77.2185,28.5340], pointIds:[''],
    blurb:'A red sandstone tomb standing in a residential colony.',
    representationScore:0.08 },
];

export const HIDDEN_FIXTURE: HiddenEntry[] = [
  { id:'c_87_1', name:'Ruined serai', distanceM:1200, representationScore:0.0,
    evidence:'Zafar Hasan Vol. 2, p. 40 - not present in the modern baseline',
    origin:'candidate', status:'verified', centroid:[77.2455,28.6410] },
  { id:'satpula', name:'Satpula', distanceM:8400, representationScore:0.12,
    evidence:'Tughlaq water dam, unlisted on major tourism platforms',
    origin:'site', centroid:[77.2200,28.5350] },
];
```

---

## 7. How to test

`tests/hidden.test.ts`:

```ts
test('less represented ranks above more represented at equal distance', () => {
  const r = rankHidden([
    { ...base, id:'a', representationScore:0.9, distanceM:1000 },
    { ...base, id:'b', representationScore:0.1, distanceM:1000 },
  ], HERE);
  expect(r[0].id).toBe('b');
});

test('distance still matters', () => {
  const r = rankHidden([
    { ...base, id:'far',  representationScore:0.0, distanceM:40000 },
    { ...base, id:'near', representationScore:0.3, distanceM:300 },
  ], HERE);
  expect(r[0].id).toBe('near');
});

test('coordinate flip is lng,lat in and lat,lng out', () => {
  expect(toLeaflet([77.2410, 28.6562])).toEqual([28.6562, 77.2410]);
});

test('every fixture site sits inside Delhi', () => {
  for (const s of SITES) {
    expect(s.centroid[0]).toBeGreaterThan(76.8);   // lng
    expect(s.centroid[0]).toBeLessThan(77.4);
    expect(s.centroid[1]).toBeGreaterThan(28.3);   // lat
    expect(s.centroid[1]).toBeLessThan(28.9);
  }
});

test('bbox contains its own centroid', () => {
  for (const s of SITES) {
    const [w,so,e,n] = s.bbox;
    expect(s.centroid[0]).toBeGreaterThanOrEqual(w);
    expect(s.centroid[0]).toBeLessThanOrEqual(e);
    expect(s.centroid[1]).toBeGreaterThanOrEqual(so);
    expect(s.centroid[1]).toBeLessThanOrEqual(n);
  }
});
```

Those last two catch the coordinate flip, which is the bug you are most likely to ship.

Manual checks before handing over:
- Paste every fixture centroid into geojson.io. All 11 in Delhi?
- Block `basemaps.cartocdn.com` in devtools. Do markers still render on a paper background?
- Resize to 375px wide. Is the panel a bottom sheet, and is the map still usable?
- Tab through the whole page. Is every marker reachable and is the focus ring visible?
- Screenshot it next to any generic dashboard. Does it look like a different kind of thing?

---

## 8. Verify your build

Add this as `scripts/verify.ts` and run `pnpm tsx scripts/verify.ts` before you submit.

**Files you must have produced:**

```
lib/types.ts                 the types from section 3
lib/geo.ts                   toLeaflet() and haversine
lib/hidden.ts                rankHidden(entries, from)
content/sites.ts             the 11 sites from section 6
app/globals.css              the @theme token block, and every hex value in the app
app/page.tsx                 the landing page
app/explore/page.tsx         the Delhi map
app/attributions/page.tsx    licences for everything used
components/Map.tsx           Leaflet, dynamically imported with ssr:false
components/SiteCard.tsx      the pin popover
components/HiddenPanel.tsx   the ranked list with evidence lines
tests/hidden.test.ts         the tests in section 7
```

**Checks that must pass:**

```ts
import { toLeaflet } from '../lib/geo';
import { rankHidden } from '../lib/hidden';
import { SITES, HIDDEN_FIXTURE } from '../content/sites';

// the flip goes lng,lat in and lat,lng out
console.assert(toLeaflet([77.2410, 28.6562])[0] === 28.6562, 'first element out must be LAT');
console.assert(toLeaflet([77.2410, 28.6562])[1] === 77.2410, 'second element out must be LNG');

for (const s of SITES) {
  console.assert(s.centroid[0] > 76.8 && s.centroid[0] < 77.4, `${s.id}: first element must be LNG`);
  console.assert(s.centroid[1] > 28.3 && s.centroid[1] < 28.9, `${s.id}: second element must be LAT`);
  console.assert(s.representationScore >= 0 && s.representationScore <= 1);
  console.assert(['deep','shallow'].includes(s.depth));

  // a bbox that does not contain its own centroid means a flipped coordinate
  const [w, so, e, n] = s.bbox;
  console.assert(s.centroid[0] >= w && s.centroid[0] <= e, `${s.id}: centroid outside bbox`);
  console.assert(s.centroid[1] >= so && s.centroid[1] <= n, `${s.id}: centroid outside bbox`);
}

console.assert(SITES.filter(s => s.depth === 'deep').length === 3);
console.assert(SITES.length >= 7);

// ranking keeps everything and puts the under-represented, nearby one first
const ranked = rankHidden(HIDDEN_FIXTURE, [77.2410, 28.6562]);
console.assert(ranked.length === HIDDEN_FIXTURE.length, 'ranking must not drop entries');
console.assert(ranked.every(e => e.evidence && e.evidence.length > 0), 'every entry needs an evidence line');
console.assert(HIDDEN_FIXTURE.some(e => e.origin === 'candidate'), 'need at least one pipeline entry');
```

Also run and fix:

```bash
# every hex value lives in the @theme block and nowhere else
grep -rn "#[0-9a-fA-F]\{6\}" app/ components/ --include=*.tsx   # must print nothing

# the coordinate flip happens in exactly one function
grep -rn "c\[1\], c\[0\]" lib/ components/ | grep -v "lib/geo.ts"   # must print nothing

pnpm vitest run        # all tests green
pnpm tsc --noEmit      # no type errors
pnpm build             # production build succeeds
```

And two by hand: block `basemaps.cartocdn.com` in devtools and confirm markers still render on a paper background; resize to 375px wide and confirm the panel becomes a bottom sheet.

---

## 9. What NOT to do

- **No dark mode.** Aged paper in dark mode is incoherent and it doubles the work for nothing a judge will see.
- **No component library.** No shadcn, no MUI, no Chakra. They arrive pre-styled to look exactly like the thing we are avoiding, and you will spend longer overriding than writing.
- **No hex values outside the `@theme` block.**
- **No Mapbox, no MapTiler, no API key.** CARTO tiles need none.
- **No feature grid on the landing page.**
- **Do not filter the whole map element** - only `.leaflet-tile-pane`.
- **Never render a Hidden Heritage entry without its evidence line.** An entry with no evidence is exactly what this project claims not to do.
- No abstraction with a single caller. No theme provider for one theme.

---

## 10. The thing that matters more than the code

A judge will ask, in some form: **"How is this different from Google Maps?"**

The Hidden Heritage panel is the answer, and it has to be visible rather than explained. Google Maps shows you what is already mapped. Every entry in your panel carries a line saying where the record of it came from and that today's map does not have it. One of them was surfaced from a 1919 document by our own pipeline an hour earlier.

That is a different kind of object from a search result, and the evidence line is what makes it obvious without a word from you.

---

## 11. How to submit

Your work goes into the main repo under `contrib/`, where it is excluded from the build and cannot break anything. Every PR that follows these steps gets merged.

```bash
# 1. fork and clone the main repo
gh repo fork https://github.com/RAK2315/sih26-team-sigmoid --clone
cd sih26-team-sigmoid

# 2. branch
git checkout -b brief-5-explore-<yourname>

# 3. copy your standalone app in
mkdir -p contrib/brief-5-explore-<yourname>
cp -r <your-app>/{app,lib,content,scripts,tests,public,package.json,tsconfig.json}       contrib/brief-5-explore-<yourname>/

# 4. check you are not committing anything you should not
git add contrib/
git diff --staged --stat
git diff --staged | grep -iE "api[_-]?key|secret|token|password"   # must print nothing

git commit -m "contrib: Brief 5 - Explore and Hidden Heritage"
git push -u origin brief-5-explore-<yourname>
gh pr create --fill
```

**What decides whether it merges:**

- Every file in the diff sits under `contrib/brief-5-explore-<yourname>/`. Nothing outside it, ever. Not the root `package.json`, not `tsconfig.json`, not CI config.
- No `.env` file, no API key, no credential anywhere in the diff.
- No `node_modules/`, no `.next/`, no audio or video files over 5MB.

Nothing else is grounds for rejection. Code style, architecture and whether the feature ends up being used are not your problem.

**PR description - copy this:**

```
## Brief 5 - Explore and Hidden Heritage

Works:
- ...

Does not work yet:
- ...

Run it:
cd contrib/brief-5-explore-<yourname> && pnpm install && pnpm dev

Verify output:
<paste the output of pnpm tsx scripts/verify.ts>
```

Be straight in "does not work yet". A PR that says what is broken is more useful than one that pretends, and it will not count against you.

