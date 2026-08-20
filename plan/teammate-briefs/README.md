# Teammate briefs

Five independent build briefs. One person per brief. Hand out one file each.

**This supersedes `plan/07-team-tasks.md`**, which split content and research rather than features. If someone has already started a task there, T6.1 (verifying the 1,300 and 174 figures against primary sources) is still worth finishing - those numbers appear in the problem statement and in the first line of the demo.

## Who owns what

| Brief | Feature | Time | Difficulty |
|---|---|---|---|
| *(me)* | Map navigation: location tracking, geofencing, the Threshold Crossing | - | - |
| 1 | Discovery engine - archival page to pins on a map | 2-3 days | highest |
| 1a | [Agent build spec](./BRIEF-1-AGENT-SPEC.md) for brief 1 - hand this to a coding agent | - | - |
| 2 | Authority dashboard - the candidate review queue | 1.5-2 days | medium, most database |
| 3 | Route planner - interests and time to an ordered walk | 1-1.5 days | medium, most algorithm |
| 4 | Narration system - audio, transcript, personas, grounded Q&A | 2 days | medium, most content |
| 5 | Explore, Hidden Heritage, landing - the front door | 1.5-2 days | medium, most design |

I am building the map navigation and Threshold Crossing myself. It is the core of the demo and the one piece that cannot slip.

## How this works

Each brief is standalone. Build it as your own Next.js app with `create-next-app`. You do not need the main repo to build, and nothing you write can break it.

When you are done, you open a pull request that adds your app under `contrib/<brief>-<yourname>/` in the main repo. That directory is excluded from the build, the typecheck, the tests and the deploy, so a PR there is always safe to merge. Full steps are in section "How to submit" at the end of every brief.

## Three rules

**1. Copy `lib/types.ts` verbatim.** Every brief contains the exact types it needs. Do not rename a field, do not change a type, do not add one because it seemed useful.

**2. Coordinates are `[lng, lat]` everywhere.** GeoJSON and turf order. Leaflet wants `[lat, lng]`, which is backwards, so the flip happens in exactly one helper function and nowhere else. This is the bug you are most likely to ship. If your pins land in the Arabian Sea, this is why.

**3. Run your brief's "Verify your build" section before you open the PR.** Each one lists the files you should have produced and a short script of assertions. Paste its output into the PR description. If something does not pass, say so in the PR rather than hiding it.

## Rules that apply to all five

- **Show the evidence, or don't show it at all.** Every claim on screen must expose where it came from within one interaction. This kills fabricated numbers, invented history, and unsourced facts. If a feature cannot show its evidence, do not build it.
- **No em dashes** anywhere - code, comments, UI copy, spoken narration. Simple hyphens with spaces, or restructure the sentence.
- **Simple and boring beats clever.** No abstraction until something is needed twice. No config systems, no plugin layers, no provider registries. A single caller does not justify an interface.
- **No `any`, no `@ts-ignore`.** If the type is hard, the design is wrong.
- **Every external call has its fallback in the same function.** Not in a wrapper. It must be impossible to read the call without seeing what happens when it fails.
- **Never invent a requirement.** If your brief does not say, ask me. Do not guess and do not quietly expand scope.

## Vocabulary

Use these exact words. They are the project's shared language and mixing in synonyms causes real confusion when five people merge.

Heritage Site, Heritage Point, Zone, Approach Ring, Threshold Crossing, Facing, Dwell, Visitor, Persona, Interest Tag, Narration, Fact Sheet, Living Tradition, Route, Walk, Volume, Page, Mention, Spatial Clue, Anchor, Uncertainty Radius, Candidate, Modern Baseline, Representation Gap, Confidence, Evidence, Reviewer.

**Never write "discovered a monument" or "AI found".** The archive recorded it, we projected it, a Reviewer confirms it. Say "surfaced a Candidate" or "identified a Representation Gap". This is not pedantry - a judge will attack any claim that an AI decided what heritage is, and the vocabulary is how we stay out of that argument.

## Submitting

Every brief ends with the exact commands. The short version:

```bash
gh repo fork <MAIN_REPO_URL> --clone
cd threshold
git checkout -b brief-N-<name>-<yourname>
mkdir -p contrib/brief-N-<name>-<yourname>
# copy your app in, then
git add contrib/ && git commit -m "contrib: ..." && git push -u origin HEAD
gh pr create --fill
```

**A PR is accepted when:**

- every changed file is inside your own `contrib/` folder
- no `.env`, no API key, no credential is in the diff
- no `node_modules/`, no `.next/`, no media over 5MB

That is the whole bar. Code style, architecture and whether the feature ends up in the final build are not grounds for rejection, and are not your problem. Say honestly what does not work yet - it will not count against you.

Attach the recording or screenshots your brief asks for as links in the PR. Do not commit video files.
