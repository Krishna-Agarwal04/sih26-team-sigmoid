# BRIEF 3 - The Route Planner

**Owner:** one person. **Time:** 1-1.5 days. **Difficulty:** medium. Most algorithm, least UI.

Build this standalone. You do not need the main repo and you will not touch its code.

---

## 1. What you are building

A visitor arrives at Red Fort with 45 minutes and an interest in architecture. There are 11 things worth seeing. Which ones, and in what order?

That is your whole job: turn `(what interests me, how long I have)` into an ordered walking route that genuinely fits, plus the screen that collects those inputs.

It sounds small. It is the feature that makes the demo personal. A judge changes 45 minutes to 90 minutes and **watches the route visibly change** - different stops, different order. That moment is worth more than it costs, and it only works if the algorithm is real. A hardcoded route collapses the instant someone picks a combination you did not anticipate.

---

## 2. Setup

```bash
npx create-next-app@16.3.1 planner --ts --tailwind --app --no-src-dir
cd planner
pnpm add @turf/turf@7.4.0 leaflet@1.9.4 react-leaflet@5.0.0
pnpm add -D vitest@4.1.11 @types/leaflet
```

---

## 3. Types

Copy verbatim as `lib/types.ts`. Do not rename, do not add fields.

```ts
export type InterestTag =
  | 'history' | 'architecture' | 'culture_traditions' | 'military' | 'religion';

export type Persona = 'history' | 'architecture' | 'kids';

export interface HeritagePoint {
  id: string;                    // 'red-fort/diwan-i-aam'
  siteId: string;                // 'red-fort'
  name: string;
  tags: InterestTag[];
  importance: 1 | 2 | 3;         // 3 = skipping it means you missed the site
  centroid: [number, number];    // [lng, lat] GeoJSON order
  narrationSec: Record<Persona, number>;  // how long each persona's audio runs
}

export interface PlanInput {
  points: HeritagePoint[];
  interests: InterestTag[];      // empty array means "everything"
  budgetMin: 30 | 45 | 90 | 240;
  persona: Persona;
  startAt: [number, number];     // [lng, lat] - the site entrance
}

export interface Route {
  pointIds: string[];            // ordered
  totalMin: number;
  walkMin: number;
  listenMin: number;
  droppedIds: string[];          // matched interests but did not fit the budget
}

export function planRoute(input: PlanInput): Route
```

**The coordinate order trap.** GeoJSON and turf use `[lng, lat]`. Leaflet uses `[lat, lng]`. Store everything as `[lng, lat]` and flip only when handing to Leaflet, in one helper, nowhere else. If your route line draws across Somalia, this is why.

**`planRoute` must be pure.** No fetch, no Date.now(), no Math.random(), no reading state. Same input gives the same output every single time. A judge running it twice and getting two routes is a dead demo.

---

## 4. The algorithm

Four steps. Keep them as four separate functions so each can be tested alone.

### Step 1: score

```ts
score(point, interests) = interestMatch * 2 + point.importance
```

where `interestMatch` is how many of the visitor's chosen interests appear in `point.tags`. If `interests` is empty, treat `interestMatch` as 1 for everything so importance alone decides.

Weight 2 on interest means a point matching two interests beats a more important point matching none. That is the behaviour you want: personalisation should be visible.

### Step 2: cost

```ts
walkSeconds(a, b) = haversineMetres(a, b) / 1.2      // 1.2 m/s, average walking pace
listenSeconds(p)  = p.narrationSec[persona]
```

Use `turf.distance` for haversine. Straight line distance, not path following. It is wrong by maybe 20 percent inside a walled complex, and that is acceptable - you are budgeting, not navigating.

### Step 3: choose the subset

Greedy by score, then trim. Start with everything that matches at least one interest, sorted by score descending. Add points one at a time. After each addition, compute the true cost of the resulting route (step 4) and stop when adding the next one would exceed the budget.

**Why compute the real route cost at each step rather than summing point costs:** two points 200m apart cost far less together than two points at opposite ends of the fort. A subset chosen on individual cost will overrun. This is the one place where doing it properly is cheap.

Everything that matched but did not fit goes into `droppedIds`. The UI shows those as "not in this route" so the visitor understands what a longer visit would buy them.

### Step 4: order them exactly

You have at most 10 points. That means exact shortest path by dynamic programming, which is trivial at this size and sounds much better than "we used nearest neighbour".

Held-Karp, open path from `startAt`, no return to start:

```
dp[mask][i] = shortest walking time that starts at startAt,
              visits exactly the set of points in `mask`,
              and ends at point i

dp[1<<i][i] = walk(startAt, points[i])
dp[mask][i] = min over j in mask, j != i of ( dp[mask ^ (1<<i)][j] + walk(j, i) )

answer = min over i of dp[full][i], then walk the parent pointers back
```

At n = 10 that is 1024 * 10 * 10 = about 100k operations. Under a millisecond. Do not use a heuristic here; the exact answer is cheaper than explaining why you did not.

**Guard:** if n > 12, fall back to nearest neighbour. It will never happen with our data, but an unguarded bitmask DP is a hang waiting for a bad content file.

### Step 5: assemble

```
walkMin   = total walking seconds / 60
listenMin = sum of narration seconds for chosen points / 60
totalMin  = walkMin + listenMin
```

`totalMin` must be within 10 percent of `walkMin + listenMin`. If it is not, you have a bug in your accounting.

---

## 5. The screen - `app/site/[slug]/plan/page.tsx`

```
+------------------------------------------------------+
|                                                      |
|   WHAT DRAWS YOU HERE?          (pick any, or none)  |
|                                                      |
|   [ History ]  [ Architecture ]  [ Culture ]         |
|   [ Military ]  [ Religion ]                         |
|                                                      |
|   HOW LONG DO YOU HAVE?                              |
|                                                      |
|   [ 30 min ]  [ 45 min ]  [ 90 min ]  [ Half day ]   |
|                                                      |
|   WHO IS LISTENING?                                  |
|                                                      |
|   [ History lover ] [ Architecture ] [ For children ]|
|                                                      |
|                                    [ Begin tour -> ] |
+------------------------------------------------------+
```

Below the fold, or on the next screen, show the resulting route: the ordered list with each stop's walk time and listen time, the total, and the dropped points greyed out.

Three things that matter:

1. **Selecting nothing is valid** and means "everything". Do not force a choice.
2. **Persist to `sessionStorage` under the key `threshold.plan.v1`** so a back-navigation does not lose the selection.
3. **The "Begin tour" button is special.** In the real app it also unlocks browser audio playback, which cannot happen without a user gesture. Keep it as a single clear primary action and do not add a second competing button next to it.

Interest and Persona are **separate axes**. A child still wants the military points. Interest decides *which* stops; Persona decides *how they are told*. Do not merge them into one control, however tempting it looks.

---

## 6. Fixture to build against

Real Red Fort points, real approximate coordinates, in visitor order west to east.

```ts
export const RED_FORT_POINTS: HeritagePoint[] = [
  { id:'red-fort/lahori-gate',     siteId:'red-fort', name:'Lahori Gate',
    tags:['history','military','architecture'], importance:3,
    centroid:[77.2385,28.6562], narrationSec:{history:95,architecture:80,kids:55} },
  { id:'red-fort/chatta-chowk',    siteId:'red-fort', name:'Chatta Chowk',
    tags:['culture_traditions','history'], importance:2,
    centroid:[77.2392,28.6560], narrationSec:{history:80,architecture:65,kids:50} },
  { id:'red-fort/naubat-khana',    siteId:'red-fort', name:'Naubat Khana',
    tags:['culture_traditions','architecture'], importance:2,
    centroid:[77.2399,28.6558], narrationSec:{history:75,architecture:85,kids:45} },
  { id:'red-fort/diwan-i-aam',     siteId:'red-fort', name:'Diwan-i-Aam',
    tags:['history','architecture'], importance:3,
    centroid:[77.2408,28.6557], narrationSec:{history:110,architecture:95,kids:60} },
  { id:'red-fort/rang-mahal',      siteId:'red-fort', name:'Rang Mahal',
    tags:['architecture','culture_traditions'], importance:2,
    centroid:[77.2415,28.6552], narrationSec:{history:85,architecture:100,kids:50} },
  { id:'red-fort/khas-mahal',      siteId:'red-fort', name:'Khas Mahal',
    tags:['history','architecture'], importance:2,
    centroid:[77.2417,28.6555], narrationSec:{history:80,architecture:90,kids:45} },
  { id:'red-fort/diwan-i-khas',    siteId:'red-fort', name:'Diwan-i-Khas',
    tags:['history','architecture'], importance:3,
    centroid:[77.2419,28.6558], narrationSec:{history:120,architecture:105,kids:65} },
  { id:'red-fort/hammam',          siteId:'red-fort', name:'Hammam',
    tags:['architecture'], importance:1,
    centroid:[77.2421,28.6561], narrationSec:{history:60,architecture:80,kids:40} },
  { id:'red-fort/moti-masjid',     siteId:'red-fort', name:'Moti Masjid',
    tags:['religion','architecture','history'], importance:2,
    centroid:[77.2418,28.6563], narrationSec:{history:90,architecture:85,kids:50} },
  { id:'red-fort/hayat-bakhsh-bagh',siteId:'red-fort',name:'Hayat Bakhsh Bagh',
    tags:['culture_traditions','architecture'], importance:2,
    centroid:[77.2414,28.6570], narrationSec:{history:75,architecture:80,kids:55} },
  { id:'red-fort/mumtaz-mahal',    siteId:'red-fort', name:'Mumtaz Mahal',
    tags:['history','culture_traditions'], importance:1,
    centroid:[77.2413,28.6548], narrationSec:{history:70,architecture:60,kids:40} },
];

export const RED_FORT_ENTRANCE: [number, number] = [77.2381, 28.6562]; // outside Lahori Gate
```

Coordinates are approximate and unverified. Good enough for building; do not present them as surveyed.

---

## 7. How to test

`tests/planner.test.ts`, run with `pnpm vitest`.

```ts
const base = { points: RED_FORT_POINTS, startAt: RED_FORT_ENTRANCE, persona: 'history' as const };

test('deterministic - same input, same output', () => {
  const a = planRoute({ ...base, interests: ['history'], budgetMin: 45 });
  const b = planRoute({ ...base, interests: ['history'], budgetMin: 45 });
  expect(a).toEqual(b);
});

test('respects the budget', () => {
  const r = planRoute({ ...base, interests: [], budgetMin: 45 });
  expect(r.totalMin).toBeLessThanOrEqual(45);
});

test('a bigger budget never gives fewer stops', () => {
  const short = planRoute({ ...base, interests: [], budgetMin: 30 });
  const long  = planRoute({ ...base, interests: [], budgetMin: 90 });
  expect(long.pointIds.length).toBeGreaterThanOrEqual(short.pointIds.length);
});

test('interests actually filter', () => {
  const r = planRoute({ ...base, interests: ['religion'], budgetMin: 90 });
  expect(r.pointIds).toContain('red-fort/moti-masjid');
});

test('no interests means everything is eligible', () => {
  const r = planRoute({ ...base, interests: [], budgetMin: 240 });
  expect(r.pointIds.length).toBe(RED_FORT_POINTS.length);
});

test('totals add up', () => {
  const r = planRoute({ ...base, interests: [], budgetMin: 90 });
  expect(r.totalMin).toBeCloseTo(r.walkMin + r.listenMin, 1);
});

test('no duplicates, and every id is real', () => {
  const r = planRoute({ ...base, interests: [], budgetMin: 90 });
  expect(new Set(r.pointIds).size).toBe(r.pointIds.length);
  for (const id of r.pointIds) {
    expect(RED_FORT_POINTS.some(p => p.id === id)).toBe(true);
  }
});

test('dropped points matched interests but did not fit', () => {
  const r = planRoute({ ...base, interests: [], budgetMin: 30 });
  expect(r.droppedIds.length).toBeGreaterThan(0);
  expect(r.pointIds.some(id => r.droppedIds.includes(id))).toBe(false);
});

test('a single point still works', () => {
  const r = planRoute({ ...base, points: [RED_FORT_POINTS[0]], interests: [], budgetMin: 45 });
  expect(r.pointIds).toEqual(['red-fort/lahori-gate']);
});

test('an empty point list does not crash', () => {
  const r = planRoute({ ...base, points: [], interests: [], budgetMin: 45 });
  expect(r.pointIds).toEqual([]);
  expect(r.totalMin).toBe(0);
});
```

Those last two are the ones that will actually catch your bugs. Bitmask DP with n = 0 or n = 1 is where this breaks.

Manual check: draw the route on a Leaflet map. Does the line ever cross itself? With exact DP it should not. If it does, your parent pointer reconstruction is wrong.

---

## 8. Verify your build

Add this as `scripts/verify.ts` and run `pnpm tsx scripts/verify.ts` before you submit.

**Files you must have produced:**

```
lib/types.ts                        the types from section 3
lib/planner.ts                      planRoute(input) plus the four step functions
lib/geo.ts                          haversine and the toLeaflet flip
content/red-fort.ts                 the fixture from section 6
app/site/[slug]/plan/page.tsx       the planner screen
components/RoutePreview.tsx         the ordered list with times and dropped points
tests/planner.test.ts               the ten tests in section 7
```

**Checks that must pass:**

```ts
import { planRoute } from '../lib/planner';
import { RED_FORT_POINTS, RED_FORT_ENTRANCE } from '../content/red-fort';

const input = { points: RED_FORT_POINTS, interests: ['architecture'] as const,
                budgetMin: 45 as const, persona: 'architecture' as const,
                startAt: RED_FORT_ENTRANCE };
const r = planRoute(input);

console.assert(Array.isArray(r.pointIds) && Array.isArray(r.droppedIds));
console.assert(r.totalMin <= 45, 'must respect the budget');
console.assert(Math.abs(r.totalMin - (r.walkMin + r.listenMin)) < 0.5, 'totals must add up');
console.assert(new Set(r.pointIds).size === r.pointIds.length, 'no duplicates');
console.assert(!r.pointIds.some(id => r.droppedIds.includes(id)), 'a point cannot be both');

// same input, same output, every time
console.assert(JSON.stringify(planRoute(input)) === JSON.stringify(r), 'must be deterministic');

// a bigger budget never gives fewer stops
const long = planRoute({ ...input, budgetMin: 90 });
console.assert(long.pointIds.length >= r.pointIds.length);

// edge cases that break bitmask DP
console.assert(planRoute({ ...input, points: [] }).pointIds.length === 0);
console.assert(planRoute({ ...input, points: [RED_FORT_POINTS[0]] }).pointIds.length === 1);

// every centroid is [lng, lat], so the first element is the big one in Delhi
for (const p of RED_FORT_POINTS) {
  console.assert(p.centroid[0] > 76.8 && p.centroid[0] < 77.4, `${p.id}: first element must be LNG`);
  console.assert(p.centroid[1] > 28.3 && p.centroid[1] < 28.9, `${p.id}: second element must be LAT`);
}
```

Also run and fix:

```bash
grep -rn "Math.random\|Date.now\|fetch(" lib/planner.ts   # must print nothing

pnpm vitest run        # all ten tests green
pnpm tsc --noEmit      # no type errors
pnpm build             # production build succeeds
```

---

## 9. What NOT to do

- **No LLM for routing.** This is a solved optimisation problem. A model is slower, non-deterministic, and can produce a route that doubles back. Wrong tool.
- **No routing API.** Not Google Directions, not OSRM, not Mapbox. Straight line distance is fine inside a walled complex and adds no key, no quota, no network call.
- **No pre-authored routes.** The whole point is that an unanticipated combination still works.
- **Nothing impure in `planRoute`.** No `Date.now()`, no `Math.random()`, no fetch.
- **Do not merge Interest and Persona.** They are separate axes for a reason.
- **Do not use nearest neighbour** unless n > 12. Exact is cheaper here and it is a better answer when asked.
- No abstraction with a single caller. No strategy pattern for "different routing algorithms".

---

## 10. The thing that matters more than the code

A judge will ask: **"Is this actually personalised or did you just hardcode a tour?"**

The answer has to be a demonstration, not a claim. Have them pick a combination on the spot - religion only, 30 minutes - and let them watch the route rebuild into something you obviously did not prepare. Then show `droppedIds`: "these matched what you wanted but would not fit in half an hour."

That second part is the one people forget, and it is what makes it feel like a real planner instead of a filter.

---

## 11. How to submit

Your work goes into the main repo under `contrib/`, where it is excluded from the build and cannot break anything. Every PR that follows these steps gets merged.

```bash
# 1. fork and clone the main repo
gh repo fork <MAIN_REPO_URL> --clone
cd threshold

# 2. branch
git checkout -b brief-3-planner-<yourname>

# 3. copy your standalone app in
mkdir -p contrib/brief-3-planner-<yourname>
cp -r <your-app>/{app,lib,content,scripts,tests,public,package.json,tsconfig.json}       contrib/brief-3-planner-<yourname>/

# 4. check you are not committing anything you should not
git add contrib/
git diff --staged --stat
git diff --staged | grep -iE "api[_-]?key|secret|token|password"   # must print nothing

git commit -m "contrib: Brief 3 - Route planner"
git push -u origin brief-3-planner-<yourname>
gh pr create --fill
```

**What decides whether it merges:**

- Every file in the diff sits under `contrib/brief-3-planner-<yourname>/`. Nothing outside it, ever. Not the root `package.json`, not `tsconfig.json`, not CI config.
- No `.env` file, no API key, no credential anywhere in the diff.
- No `node_modules/`, no `.next/`, no audio or video files over 5MB.

Nothing else is grounds for rejection. Code style, architecture and whether the feature ends up being used are not your problem.

**PR description - copy this:**

```
## Brief 3 - Route planner

Works:
- ...

Does not work yet:
- ...

Run it:
cd contrib/brief-3-planner-<yourname> && pnpm install && pnpm dev

Verify output:
<paste the output of pnpm tsx scripts/verify.ts>
```

Be straight in "does not work yet". A PR that says what is broken is more useful than one that pretends, and it will not count against you.

