# BRIEF 2 - The Authority Dashboard

**Owner:** one person. **Time:** 1.5-2 days. **Difficulty:** medium. Most database work of the five.

Build this standalone. You do not need the main repo and you will not touch its code.

---

## 1. What you are building

The screen where a real person decides what is true.

Our pipeline reads century-old survey documents and produces **Candidates**: structures the record described, projected onto a modern map with an uncertainty radius. A Candidate is a claim the archive made, not a claim we make. Nothing automated is ever allowed to declare a monument real.

Your screen is where a Reviewer (think ASI or a state archaeology department) works through that queue, inspects the evidence behind each Candidate, and moves it to verified, rejected, or "actually this is already documented". You also show which Heritage Points visitors actually walked to.

This is the screen that turns the project from an app into a system with a stakeholder. It is also the single cheapest way to prove the whole thing is real: **the walk a judge takes on stage three minutes earlier must show up in your visit log.**

---

## 2. Setup

```bash
npx create-next-app@16.3.1 authority --ts --tailwind --app --no-src-dir
cd authority
pnpm add @supabase/supabase-js@2.112.3 zod@4.4.3
pnpm add -D vitest@4.1.11
```

Create a free project at supabase.com. Put the URL and anon key in `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## 3. The schema

Run this exactly. Do not rename a column, do not add one, do not "improve" a type.

```sql
create table candidates (
  id                    text primary key,
  volume_id             text        not null,
  page_no               integer     not null,
  mention_name          text        not null,
  structure_type        text        not null,
  period                text,
  passage               text        not null,
  passage_start         integer,
  passage_end           integer,
  anchor_id             text,
  bearing               text,
  distance_value        numeric,
  distance_unit         text,
  lng                   double precision,
  lat                   double precision,
  uncertainty_radius_m  numeric,
  status                text        not null default 'extracted',
  confidence            numeric,
  confidence_parts      jsonb       not null default '{}'::jsonb,
  matched_feature_id    text,
  matched_feature_name  text,
  matched_distance_m    numeric,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint candidates_status_chk check (status in (
    'extracted','geo_resolved','candidate','under_review',
    'verified','rejected','matched_existing')),
  constraint candidates_radius_chk check (
    (lng is null and lat is null) or uncertainty_radius_m is not null),
  constraint candidates_match_chk check (
    status <> 'matched_existing' or matched_feature_id is not null)
);

create table candidate_events (
  id            bigserial primary key,
  candidate_id  text        not null references candidates(id) on delete cascade,
  from_status   text,
  to_status     text        not null,
  note          text,
  actor         text        not null default 'reviewer',
  created_at    timestamptz not null default now()
);

create table walk_crossings (
  id               bigserial primary key,
  walk_id          text        not null,
  point_id         text        not null,
  site_id          text        not null,
  persona          text        not null,
  kind             text        not null,
  location_source  text        not null,
  created_at       timestamptz not null default now(),
  constraint walk_crossings_persona_chk check (persona in ('history','architecture','kids')),
  constraint walk_crossings_kind_chk    check (kind    in ('approach','inside')),
  constraint walk_crossings_source_chk  check (location_source in ('sim','gps'))
);

create index on candidates (status);
create index on candidate_events (candidate_id, created_at desc);
create index on walk_crossings (created_at desc);
```

Note the three constraints at the bottom of `candidates`. They encode rules, not preferences:
- **A coordinate must come with an uncertainty radius.** A bare coordinate is a lie.
- **A match must name what it matched.** "This is already documented" with no reference is not a review decision.

---

## 4. The lifecycle - the most important part of this brief

```
extracted -> geo_resolved -> candidate -> under_review -> verified
                                                       -> rejected
                                                       -> matched_existing
```

Two rules, and everything else follows from them.

**Rule 1: automation stops at `candidate`.** The pipeline may go `extracted` to `geo_resolved` to `candidate` and no further. It does not matter if confidence is 0.99. Only a human moves it past that line.

**Rule 2: `verified` and `rejected` are terminal.** `matched_existing` can reopen to `under_review` if a Reviewer disputes the match, because sometimes two nearby structures get confused for each other.

Build this as one pure function and nowhere else:

```ts
// lib/transitions.ts  -- pure, no I/O, TEST THIS
export function canTransition(from: CandidateStatus, to: CandidateStatus): boolean
```

Legal moves, exhaustively:
```
candidate        -> under_review
under_review     -> verified | rejected | matched_existing
matched_existing -> under_review
everything else  -> false
```

Every status change in your app goes through this function. If the rule lives in two places it will disagree with itself by Thursday.

**Why `matched_existing` exists at all:** it is the state where the pipeline finds something that IS already on today's map. People forget it, and it is the most persuasive result you have, because it proves the system finds real things rather than inventing pins. Make sure your seed data contains at least one.

---

## 5. What to build

### 5.1 The queue

A table of Candidates: name, structure type, confidence, status, and which volume and page it came from. Default sort: highest confidence first, `candidate` status first. Filterable by status.

Status must be shown with a colour **and a word and a shape**. Five colours alone are not distinguishable to every viewer and they will not survive a projector.

```
  amber  hexagon   candidate         automated ceiling
  indigo circle    under review      a human has it
  green  check     verified          a human confirmed it
  grey   dash      rejected          terminal
  violet link      matched existing  already on today's map
```

### 5.2 The Evidence panel

Opens from any row. This is the heart of the screen and the thing a judge will actually read. It shows:

- The exact passage from the source document
- Which volume, which page
- Which Anchor the location was measured from, and the bearing and distance as originally written ("200 yards N of Kotla Firoz Shah")
- The resolved coordinate and its uncertainty radius in metres
- Which baseline features were checked, and what was or was not found
- **Confidence broken into its five named parts with their weights**, not one number

```
CONFIDENCE  0.71

source reliability      0.90  x 0.30  = 0.270
clue specificity        0.75  x 0.25  = 0.188
anchor precision        0.80  x 0.20  = 0.160
cross-source agreement  0.00  x 0.15  = 0.000
modern evidence         0.40  x 0.10  = 0.040
                                  total 0.658
```

A single opaque "87% confident" is worse than showing nothing. The breakdown is the difference between a system that can be trusted and one that asks to be.

### 5.3 The decision

Buttons that fire the legal transitions only. Illegal ones are not disabled, they are **not rendered**. Each writes a row to `candidate_events` with from status, to status, and an optional note.

`candidate_events` is **append-only**. Never update it, never delete from it. It is the audit trail of the review decision itself, which is the one thing that makes the workflow defensible.

Show the event history under each Candidate as a small timeline.

### 5.4 The walk log

A list of recent Threshold Crossings from `walk_crossings`: which Heritage Point, which Persona, which location source, how long ago.

Three real counters at the top: Pages processed, Candidates surfaced, Representation Gaps outstanding. **Derived from actual rows.** No charts. A chart of invented numbers is the least convincing object on any hackathon screen, and a judge who asks where the data came from will get an answer you do not want to give.

### 5.5 Failure behaviour

Supabase free projects pause when idle. If the client fails:

- Read `content/candidates.seed.json` from your repo instead
- Render the queue normally with a small **stale** chip naming the source
- Let status changes apply optimistically in memory so the verify moment still works on screen
- For walk crossings, queue in memory and say "3 crossings not yet saved" rather than showing zero

A labelled fallback is a stronger position than a hidden one. If a judge asks whether it is live, the answer is already on the screen.

---

## 6. Seed data

Write `scripts/seed.ts` that loads `content/candidates.seed.json` into Supabase. About 15 Candidates. Composition matters:

- 8 in `candidate` status, varying confidence 0.4 to 0.9
- 2 in `under_review`
- 2 `verified`
- 1 `rejected`
- **at least 2 `matched_existing`** with real named matches

Every one needs a real passage, a real page number, and a coordinate in Delhi. Make them plausible. If a judge pastes a coordinate into Google Maps and it lands in the sea, the whole screen dies.

Bounds check: Delhi is roughly lng 76.84 to 77.35, lat 28.40 to 28.88.

---

## 7. How to test

`tests/transitions.test.ts`, run with `pnpm vitest`. Every case:

```ts
test('automation cannot reach verified', () => {
  expect(canTransition('candidate', 'verified')).toBe(false);
  expect(canTransition('geo_resolved', 'verified')).toBe(false);
  expect(canTransition('extracted', 'verified')).toBe(false);
});

test('the only way forward from candidate is under_review', () => {
  expect(canTransition('candidate', 'under_review')).toBe(true);
  expect(canTransition('candidate', 'rejected')).toBe(false);
  expect(canTransition('candidate', 'matched_existing')).toBe(false);
});

test('verified and rejected are terminal', () => {
  const all: CandidateStatus[] = ['extracted','geo_resolved','candidate',
    'under_review','verified','rejected','matched_existing'];
  for (const to of all) {
    expect(canTransition('verified', to)).toBe(false);
    expect(canTransition('rejected', to)).toBe(false);
  }
});

test('matched_existing can be disputed back to under_review', () => {
  expect(canTransition('matched_existing', 'under_review')).toBe(true);
  expect(canTransition('matched_existing', 'verified')).toBe(false);
});
```

Manual checks before handing over:
- Change a status. Refresh. Did it persist?
- Check `candidate_events` in the Supabase table editor. Is there a row with the right from and to?
- Break your Supabase URL on purpose. Does the queue still render from the seed file with a stale chip?
- Try to move `verified` to `rejected` from the UI. The button should not exist.

---

## 8. Verify your build

Add this as `scripts/verify.ts` and run `pnpm tsx scripts/verify.ts` before you submit.

**Files you must have produced:**

```
lib/types.ts                  the types from section 3
lib/transitions.ts            canTransition(from, to)
lib/supabase.ts               the only createClient() call
app/authority/page.tsx        the queue
components/EvidencePanel.tsx  the evidence view
components/WalkLog.tsx        recent Threshold Crossings
content/candidates.seed.json  about 15 seeded Candidates
scripts/seed.ts               loads the seed file into Supabase
tests/transitions.test.ts     the tests in section 7
schema.sql                    the SQL from section 3, as you ran it
```

**Checks that must pass:**

```ts
import { canTransition } from '../lib/transitions';
import seed from '../content/candidates.seed.json';

// the wall between automation and a human decision
console.assert(canTransition('candidate', 'under_review') === true);
console.assert(canTransition('candidate', 'verified') === false);
console.assert(canTransition('geo_resolved', 'verified') === false);

// terminal states stay terminal
console.assert(canTransition('verified', 'under_review') === false);
console.assert(canTransition('rejected', 'under_review') === false);

// a disputed match can reopen
console.assert(canTransition('matched_existing', 'under_review') === true);

// seed data is usable
const STATUSES = ['extracted','geo_resolved','candidate','under_review',
                  'verified','rejected','matched_existing'];
console.assert(seed.length >= 12, 'need about 15 candidates');
console.assert(seed.some(c => c.status === 'matched_existing'), 'need at least one matched_existing');
for (const c of seed) {
  console.assert(STATUSES.includes(c.status), `bad status: ${c.status}`);
  console.assert(c.lng > 76.8 && c.lng < 77.4, `${c.id}: lng outside Delhi`);
  console.assert(c.lat > 28.3 && c.lat < 28.9, `${c.id}: lat outside Delhi`);
  console.assert(c.uncertainty_radius_m != null, `${c.id}: coordinate without a radius`);
  console.assert(c.passage && c.passage.length > 10, `${c.id}: needs a real passage`);
}
```

Also run and fix:

```bash
psql "$SUPABASE_DB_URL" -c "select distinct status from candidates order by 1;"
# every value must be one of the seven in the enum

pnpm vitest run        # all tests green
pnpm tsc --noEmit      # no type errors
pnpm build             # production build succeeds
```

---

## 9. What NOT to do

- **No login, no auth, no roles.** The route is open. It is a known and accepted gap, documented in our risk register. Do not spend a day on Supabase Auth.
- **No charts.** Three real counters, nothing else.
- **No PostGIS.** All spatial work happens in TypeScript elsewhere. Two doubles for lng and lat is the whole geometry story here.
- **Never let code call `canTransition` and then ignore the answer.** If it returns false, return HTTP 409, do not "handle it gracefully" by allowing it.
- **Never update or delete a `candidate_events` row.** Append only, always.
- **No ORM, no Prisma, no query builder.** Supabase client directly. One dependency, not three.
- No abstraction with a single caller.

---

## 10. The thing that matters more than the code

A judge will ask: **"So the AI decides what is a heritage site?"**

The correct answer is no, and your screen is the proof. Automation stops at `candidate`. A human moves it further. The audit trail records who moved it and when. That is not a limitation we are apologising for, it is the design.

Build the screen so a judge can see that in five seconds without you explaining it. The status colours should make the wall between `candidate` and everything past it visually obvious.

---

## 11. How to submit

Your work goes into the main repo under `contrib/`, where it is excluded from the build and cannot break anything. Every PR that follows these steps gets merged.

```bash
# 1. fork and clone the main repo
gh repo fork https://github.com/RAK2315/sih26-team-sigmoid --clone
cd sih26-team-sigmoid

# 2. branch
git checkout -b brief-2-authority-<yourname>

# 3. copy your standalone app in
mkdir -p contrib/brief-2-authority-<yourname>
cp -r <your-app>/{app,lib,content,scripts,tests,public,package.json,tsconfig.json}       contrib/brief-2-authority-<yourname>/

# 4. check you are not committing anything you should not
git add contrib/
git diff --staged --stat
git diff --staged | grep -iE "api[_-]?key|secret|token|password"   # must print nothing

git commit -m "contrib: Brief 2 - Authority dashboard"
git push -u origin brief-2-authority-<yourname>
gh pr create --fill
```

**What decides whether it merges:**

- Every file in the diff sits under `contrib/brief-2-authority-<yourname>/`. Nothing outside it, ever. Not the root `package.json`, not `tsconfig.json`, not CI config.
- No `.env` file, no API key, no credential anywhere in the diff.
- No `node_modules/`, no `.next/`, no audio or video files over 5MB.

Nothing else is grounds for rejection. Code style, architecture and whether the feature ends up being used are not your problem.

**PR description - copy this:**

```
## Brief 2 - Authority dashboard

Works:
- ...

Does not work yet:
- ...

Run it:
cd contrib/brief-2-authority-<yourname> && pnpm install && pnpm dev

Verify output:
<paste the output of pnpm tsx scripts/verify.ts>
```

Be straight in "does not work yet". A PR that says what is broken is more useful than one that pretends, and it will not count against you.

