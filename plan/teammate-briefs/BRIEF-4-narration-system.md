# BRIEF 4 - The Narration System

**Owner:** Krishna. **Time:** 2 days. **Difficulty:** medium. Most content work, most audible payoff.

Build this standalone. You do not need the main repo and you will not touch its code.

---

## 1. What you are building

The voice. When a visitor reaches a structure, this is what speaks.

You are building four things that sit together: the audio pipeline that turns written facts into good-sounding narration, the player that plays it with a synchronised transcript, the persona system that tells the same place three different ways, and a question box that answers a visitor's question without making anything up.

This is the emotional payload of the whole project. Everything else is scaffolding that gets a person to the right spot; you are what happens when they arrive. If this sounds like a robot reading Wikipedia, the project fails no matter how good the rest is.

---

## 2. Setup

```bash
npx create-next-app@16.3.1 narration --ts --tailwind --app --no-src-dir
cd narration
pnpm add @google/genai@2.17.1 zod@4.4.3
pnpm add -D vitest@4.1.11 tsx

# audio rendering - free, no API key, no quota, good Indian voices
pip install edge-tts
edge-tts --list-voices | grep -E "en-IN|hi-IN"
```

Free Gemini key from aistudio.google.com into `.env.local` as `GEMINI_API_KEY`. Free tier is about 10 requests per minute, so rate limit your render script.

---

## 3. Types

Copy verbatim as `lib/types.ts`.

```ts
export type Persona = 'history' | 'architecture' | 'kids';
export type Lang = 'en' | 'hi';
export type NarrationKind = 'approach' | 'inside';
export type TraditionStatus = 'living' | 'dormant' | 'lost';

export interface FactSheetLine {
  id: string;            // 'fs_diwan_i_aam_l3'
  text: string;          // ONE self-contained sentence
  source: string;        // never empty, never "general knowledge"
}

export interface FactSheet {
  id: string;            // 'fs_diwan_i_aam'
  pointId: string;       // 'red-fort/diwan-i-aam'
  lines: FactSheetLine[];
  sources: { label: string; url?: string; kind: 'asi'|'archive'|'book'|'wikipedia' }[];
}

export interface Narration {
  pointId: string;
  persona: Persona;
  lang: Lang;
  kind: NarrationKind;
  audioUrl: string;      // '/audio/red-fort/diwan-i-aam/history.en.mp3'
  durationSec: number;
  sentences: string[];
  cues: number[];        // cues[i] = start time in seconds of sentences[i]
  factSheetId: string;   // every narration traces back to one fact sheet
}

export interface LivingTradition {
  name: string;
  text: string;
  status: TraditionStatus;
}
```

Two invariants that must never break:

- **`cues.length === sentences.length`.** Always. This is what the transcript highlighting depends on.
- **Every Narration has a `factSheetId`.** Nothing is ever spoken that a Fact Sheet does not support.

---

## 4. What to build

### 4.1 Fact Sheets - the foundation

For each Heritage Point, 8 to 12 lines. Each line is **one self-contained sentence a narrator could speak**, with a source you can name.

```ts
{
  id: 'fs_diwan_i_aam',
  pointId: 'red-fort/diwan-i-aam',
  lines: [
    { id:'fs_diwan_i_aam_l1',
      text:'The Diwan-i-Aam was the hall where the emperor heard petitions from the public.',
      source:'ASI Red Fort site documentation' },
    { id:'fs_diwan_i_aam_l2',
      text:'It was completed around 1648, as part of Shah Jahan\'s new capital Shahjahanabad.',
      source:'Zafar Hasan, List of Muhammadan and Hindu Monuments, Vol. I (1916), p. 12' },
    // ...
  ],
  sources: [{ label:'ASI Red Fort', kind:'asi' }],
}
```

**A line without a nameable source does not go in.** Not "general knowledge", not "commonly known". If you cannot name where it came from, it is not a fact, it is a rumour, and a history judge will find it.

Start with 4 Heritage Points: Diwan-i-Aam, Diwan-i-Khas, Rang Mahal, Lahori Gate. Get those right, then work outward through the list in 4.1b.

### 4.1b How far to go - the Delhi list

Once Red Fort reads well, **keep going**. Fact Sheets are the thing this project runs short of, and every one you write is one we do not have to. Work down this list in order. Anything you finish is used; anything you do not is simply not used, and nothing breaks either way.

Write each as its own file. One Fact Sheet, one Living Tradition, one Narration per Persona. Do not wait until the list is finished to open a PR - open one when Red Fort is done, then add to it.

**Tier 1, the ones a visitor has heard of.** These carry the demo.

Red Fort - Qutub complex - Humayun's Tomb complex - Jama Masjid - Purana Qila - Safdarjung's Tomb - Tughlaqabad Fort - Hauz Khas complex - Lodi Gardens - Jantar Mantar - Nizamuddin Dargah - Feroz Shah Kotla

**Tier 2, real monuments that most people in Delhi have never entered.** This tier is the point of the project. A judge who lives in Delhi should read this list and find something they did not know was there.

Agrasen ki Baoli - Rajon ki Baoli - Gandhak ki Baoli - Zafar Mahal, Mehrauli - Jahaz Mahal, Mehrauli - Jamali Kamali mosque and tomb - Balban's Tomb - Quli Khan's Tomb - Adham Khan's Tomb, called Bhulbhulaiyan - Bhuli Bhatiyari ka Mahal - Satpula - Chausath Khamba - Lal Gumbad - Khirki Masjid - Begumpuri Masjid - Bijay Mandal - Moth ki Masjid - Chor Minar - Sultan Ghari - Abdur Rahim Khan-i-Khanan's Tomb - Najaf Khan's Tomb - Nila Gumbad - Athpula - Hijron ka Khanqah - Dadi Poti ka Gumbad - Bara Lao ka Gumbad - Madhi Masjid - Wazirpur group of tombs - Mutiny Memorial - Coronation Park - Dara Shikoh Library

**Tier 3, Living Traditions rather than buildings.** These answer the "traditions" half of the theme and they are the easiest thing on this list to get wrong, so source them hard. Attach each one to the Heritage Point it actually belongs to rather than inventing a site for it.

Qawwali at Nizamuddin on Thursday nights - Phool Walon ki Sair in Mehrauli - the Dilli gharana of Hindustani music - zardozi and karchobi embroidery in Old Delhi - meenakari and thathera metalwork - ittar sellers in Gali Ballimaran - kite making around Lal Kuan before Independence Day - Urdu mushaira - Ramlila at Ramlila Maidan - the food streets of Chandni Chowk and Matia Mahal

### 4.1c Where the facts come from

Do not write from memory, and do not write from a blog. In rough order of how much a judge will trust them:

1. **Zafar Hasan, _List of Muhammadan and Hindu Monuments, Delhi Province_,** Archaeological Survey of India, 1916 to 1922. Public domain, and it covers most of Tier 2 by name.
   - Vol. 1, walled city: `https://archive.org/details/in.ernet.dli.2015.70478`
   - Vol. 2, outlying areas: `https://archive.org/details/in.ernet.dli.2015.69530`
   - Vol. 3: `https://archive.org/details/in.ernet.dli.2015.69531`
   Cite as `Zafar Hasan, Vol. II (1919), p. 40`. Use the printed page number on the scan.
2. **ASI Delhi Circle** listings and on-site information boards. Cite as `kind: 'asi'`.
3. **INTACH Delhi** listings, and named books - Carr Stephen, Fanshawe, Percival Spear, Narayani Gupta, Rana Safvi. Cite the author and page.
4. **Wikipedia only when it carries its own reference**, and then cite that reference rather than the article.

For coordinates, look the place up on OpenStreetMap and take the coordinate off the mapped feature. If OSM does not have it, say so in your PR rather than guessing - we would rather show a site with an honest "position approximate" label than a confident wrong pin.

**House rules that apply to every line you write:** no em dashes and no en dashes, in the text or the narration, because they also make text-to-speech pause strangely. Straight quotes only. A line without a nameable source does not go in.


### 4.2 Living Tradition - one per point

The intangible half. What people still *do* at or because of this place: a ritual, a craft, a cuisine, a performance.

```ts
{
  name: 'Jharokha darshan',
  text: 'Each morning the emperor appeared at the balcony above this hall so that the public could see him. The practice bound the ruler to a daily obligation of being visible...',
  status: 'lost',
}
```

Judge `living`, `dormant` or `lost` honestly and be able to defend the call in one sentence. Chatta Chowk is the hard one: the trade did not die, it moved to Chandni Chowk. Saying that precisely is better than forcing it into a category.

This is how the project answers the "traditions" half of the theme without building a second module. It matters more than its size suggests.

### 4.3 Generation - `scripts/generate-narration.ts`

Take a Fact Sheet, produce three persona variants. Run it offline, review the output, commit it. **Never at runtime.**

- `history` - 90 to 120 seconds. Political and historical context. Who, when, why it mattered.
- `architecture` - 80 to 110 seconds. Material, structure, proportion, technique. Real vocabulary: cusped arch, pietra dura, baluster column. Not adjectives.
- `kids` - 45 to 65 seconds. For a nine year old. **This is the hardest one.** No invented detail, no "imagine if you were". Making it vivid using only true things is the entire skill.

Also generate an `inside` variant per point: 20 to 25 seconds, one specific detail you would only notice standing inside.

Rules for the prompt:
- The model may only use facts from the supplied lines. It may reorder, join and rephrase them. It may not add.
- Output plain sentences with no markdown, no headings, no stage directions.
- **No em dashes.** They make TTS pause oddly. Simple hyphens or restructure.
- Return an array of sentences, not a paragraph, because the transcript needs them separated.

Then read the output yourself before committing it. Every single one. A model that adds a plausible-sounding date is the exact failure mode this project cannot survive.

### 4.4 Audio - `scripts/render-audio.ts`

```bash
edge-tts --voice en-IN-PrabhatNeural --text "..." \
         --write-media out.mp3 --write-subtitles out.vtt
```

Voices: `en-IN-PrabhatNeural` for history and architecture, `en-IN-NeerjaNeural` for kids. Hindi later uses `hi-IN-MadhurNeural` and `hi-IN-SwaraNeural` from the same family, which is why we are not mixing engines.

Output to `public/audio/{siteId}/{pointId}/{persona}.{lang}.mp3`.

**The cues are the point of the `--write-subtitles` flag.** Parse the VTT to get the start time of each sentence and write it into the Narration's `cues` array. Do not try to measure timing at runtime; it will drift and you will not know why.

Also emit a manifest with the SHA of the source text. If the text changes and the audio is not re-rendered, the transcript silently desynchronises. The manifest is how that gets caught.

11 points x 3 personas + 11 inside variants is about 44 clips. Sleep between calls.

### 4.5 The player - `lib/player.ts` and the transcript panel

```ts
export interface NarrationPlayer {
  play(n: Narration): void;
  pause(): void;
  resume(): void;
  stop(): void;
  onSentence(cb: (index: number) => void): () => void;
  onEnded(cb: () => void): () => void;
}
```

Drive an `<audio>` element. On `timeupdate`, find the current sentence by scanning `cues` and fire `onSentence` when the index changes.

The transcript panel shows every sentence with the current one highlighted, and auto-scrolls to keep it visible.

**Two things that will bite you:**

**Audio autoplay is blocked** until the user has interacted with the page. In the real app, narration starts automatically when a visitor walks into range, with no click at that moment. The fix is to play a silent buffer during an earlier button press:

```ts
export function unlockAudio(el: HTMLAudioElement) {
  el.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQ...';
  el.play().catch(() => {});
}
```

Call it from your play button. Test in a **fresh browser profile** - your dev profile has already granted everything and will hide this bug until demo day.

**The transcript is not optional.** It is real accessibility for deaf and hard of hearing visitors, and it is the reason the demo survives a projector with no working audio. With the device muted, the transcript alone must convey the whole narration.

### 4.6 Persona switching

A control that switches persona and replays the current point. It must be an audibly different narration, not the same text at a different speed.

### 4.7 Ask about this place - `app/api/ask/route.ts`

The only live model call in the visitor path, and deliberately optional.

```jsonc
// POST /api/ask
{ "pointId": "red-fort/diwan-i-aam", "question": "Why is this hall so wide?" }

// 200
{ "answer": "...", "citedLineIds": ["fs_diwan_i_aam_l3"], "grounded": true }

// question outside the fact sheet
{ "answer": "The fact sheet for this place doesn't cover that.", "citedLineIds": [], "grounded": false }
```

Send **only** that point's Fact Sheet lines, each with its id, and require the model to cite the ids it used.

Then verify. **Any cited id that does not exist means the answer is discarded** and `grounded: false` is returned:

```ts
const known = new Set(factSheet.lines.map(l => l.id));
if (!res.citedLineIds.every(id => known.has(id))) {
  return { answer: "I can't answer that from the sources I have.", citedLineIds: [], grounded: false };
}
```

That check is the difference between grounding and hoping. A model that invents a citation id is a model that invented the answer.

Show the cited lines under the answer so the visitor can read the source themselves.

### 4.8 Then vs Now

A draggable divider comparing an archival photograph with a modern one, for 3 to 5 points.

Wikimedia Commons only. Pre-1930 photography is public domain by age (Beato, Bourne, Shepherd and Robertson shot Delhi extensively). Modern images are CC-BY-SA and need credit shown at point of use.

**No generated or AI-reconstructed imagery of real monuments. Ever.** At a heritage judging panel that is not a shortcut, it is the thing that ends you.

Match the viewpoints. Two photos of the same building from opposite ends are not a comparison.

---

## 5. How to test

`tests/player.test.ts`:

```ts
test('cues and sentences are the same length', () => {
  for (const n of ALL_NARRATIONS) {
    expect(n.cues.length).toBe(n.sentences.length);
  }
});

test('cues increase and start at or after zero', () => {
  for (const n of ALL_NARRATIONS) {
    expect(n.cues[0]).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < n.cues.length; i++) {
      expect(n.cues[i]).toBeGreaterThan(n.cues[i - 1]);
    }
  }
});

test('no cue starts after the audio ends', () => {
  for (const n of ALL_NARRATIONS) {
    expect(n.cues.at(-1)).toBeLessThan(n.durationSec);
  }
});

test('every narration traces to a real fact sheet', () => {
  const ids = new Set(ALL_FACT_SHEETS.map(f => f.id));
  for (const n of ALL_NARRATIONS) expect(ids.has(n.factSheetId)).toBe(true);
});

test('every fact sheet line has a real source', () => {
  for (const f of ALL_FACT_SHEETS)
    for (const l of f.lines) {
      expect(l.source.trim().length).toBeGreaterThan(0);
      expect(l.source.toLowerCase()).not.toContain('general knowledge');
    }
});

test('sentence index for a timestamp', () => {
  const n = { cues: [0, 4.2, 9.8, 15.1] } as Narration;
  expect(sentenceIndexAt(n, 0)).toBe(0);
  expect(sentenceIndexAt(n, 4.1)).toBe(0);
  expect(sentenceIndexAt(n, 4.3)).toBe(1);
  expect(sentenceIndexAt(n, 99)).toBe(3);
});
```

Manual checks before handing over:
- **Fresh browser profile.** Does the first playback work, or is it silently blocked?
- Mute the laptop entirely. Can you follow the whole narration from the transcript?
- Switch persona mid-playback. Does the old audio stop, or do two voices talk over each other?
- Ask the question box something the fact sheet does not cover. Does it decline, or does it invent?
- Read all 12 generated narrations against their fact sheets. Any sentence the sheet does not support gets cut.

---

## 6. Verify your build

Add this as `scripts/verify.ts` and run `pnpm tsx scripts/verify.ts` before you submit.

**Files you must have produced:**

```
lib/types.ts                     the types from section 3
lib/player.ts                    NarrationPlayer plus sentenceIndexAt()
content/factsheets/*.ts          4 or more Fact Sheets, every line sourced
content/narrations/*.ts          3 personas + 1 inside variant per point
content/traditions/*.ts          one Living Tradition per point
public/audio/**/*.mp3            the rendered clips
scripts/generate-narration.ts    Fact Sheet to persona variants, offline
scripts/render-audio.ts          text to mp3 + cues, offline
app/api/ask/route.ts             the grounded question endpoint
components/TranscriptPanel.tsx   sentence-synced transcript
components/ThenNow.tsx           the draggable comparison
tests/player.test.ts             the tests in section 5
```

**Checks that must pass:**

```ts
import fs from 'fs';
import { ALL_NARRATIONS } from '../content/narrations';
import { ALL_FACT_SHEETS } from '../content/factsheets';
import { sentenceIndexAt } from '../lib/player';

const sheetIds = new Set(ALL_FACT_SHEETS.map(f => f.id));

for (const n of ALL_NARRATIONS) {
  console.assert(n.cues.length === n.sentences.length, `${n.pointId}: cue count mismatch`);
  console.assert(n.cues[0] >= 0, `${n.pointId}: first cue is negative`);
  console.assert(n.cues.every((c, i) => i === 0 || c > n.cues[i - 1]), `${n.pointId}: cues not increasing`);
  console.assert(n.cues.at(-1)! < n.durationSec, `${n.pointId}: cue starts after the audio ends`);
  console.assert(n.durationSec > 0);
  console.assert(n.audioUrl.startsWith('/audio/'), `${n.pointId}: audioUrl must be a public path`);
  console.assert(fs.existsSync('public' + n.audioUrl), `missing audio file ${n.audioUrl}`);
  console.assert(sheetIds.has(n.factSheetId), `${n.pointId}: factSheetId does not exist`);
  console.assert(['history','architecture','kids'].includes(n.persona));
}

// nothing is spoken that a source does not support
for (const f of ALL_FACT_SHEETS) {
  console.assert(f.lines.length >= 8, `${f.id}: needs 8 or more lines`);
  for (const l of f.lines) {
    console.assert(l.source.trim().length > 0, `${l.id}: empty source`);
    console.assert(!/general knowledge|common knowledge/i.test(l.source), `${l.id}: not a source`);
  }
}

// sentence lookup
const fake = { cues: [0, 4.2, 9.8, 15.1] } as never;
console.assert(sentenceIndexAt(fake, 4.1) === 0);
console.assert(sentenceIndexAt(fake, 4.3) === 1);
console.assert(sentenceIndexAt(fake, 99) === 3);
```

Also run and fix:

```bash
grep -rn "—\|–" content/narrations/ content/factsheets/   # must print nothing

pnpm vitest run        # all tests green
pnpm tsc --noEmit      # no type errors
pnpm build             # production build succeeds
```

And once by hand, in a **fresh browser profile**: does the first playback actually produce sound, or is it silently blocked?

---

## 7. What NOT to do

- **No live TTS.** Audio is rendered offline and shipped as files. Three seconds of silence at the moment a visitor arrives is the worst failure this project has.
- **No live narration generation.** Generated offline, human reviewed, committed. A model saying something wrong about a real monument to a history judge is unrecoverable.
- **No browser `speechSynthesis` as the main path.** It is the fallback only. It sounds cheap and it will undercut your best moment.
- **No fact without a source.** No exceptions.
- **No generated imagery of real monuments.**
- **No em dashes in any spoken text.** They make TTS pause strangely.
- **Do not measure sentence timing at runtime.** Use the cues from the VTT.
- No abstraction with a single caller. No "TTS provider interface" for one provider.

---

## 8. The thing that matters more than the code

A judge will ask: **"Did a historian check any of this?"**

The honest answer is that every sentence traces to a named source, visible in the app, and the model was never allowed to add a fact - only to rephrase supplied ones. Then show them: open a narration, open its fact sheet, point at the sources.

The second question is: **"What if it says something wrong?"** The answer is that the generation is offline and reviewed, so a wrong sentence is a human error we can find and fix, not a live hallucination we cannot predict. The only live surface is the question box, and it refuses to answer outside its sources.

Build both answers into the screen so they are visible without you speaking.

---

## 9. How to submit

Your work goes into the main repo under `contrib/`, where it is excluded from the build and cannot break anything. Every PR that follows these steps gets merged.

```bash
# 1. fork and clone the main repo
gh repo fork https://github.com/RAK2315/sih26-team-sigmoid --clone
cd sih26-team-sigmoid

# 2. branch
git checkout -b brief-4-narration-<yourname>

# 3. copy your standalone app in
mkdir -p contrib/brief-4-narration-<yourname>
cp -r <your-app>/{app,lib,content,scripts,tests,public,package.json,tsconfig.json}       contrib/brief-4-narration-<yourname>/

# 4. check you are not committing anything you should not
git add contrib/
git diff --staged --stat
git diff --staged | grep -iE "api[_-]?key|secret|token|password"   # must print nothing

git commit -m "contrib: Brief 4 - Narration system"
git push -u origin brief-4-narration-<yourname>
gh pr create --fill
```

**What decides whether it merges:**

- Every file in the diff sits under `contrib/brief-4-narration-<yourname>/`. Nothing outside it, ever. Not the root `package.json`, not `tsconfig.json`, not CI config.
- No `.env` file, no API key, no credential anywhere in the diff.
- No `node_modules/`, no `.next/`, no audio or video files over 5MB.

Nothing else is grounds for rejection. Code style, architecture and whether the feature ends up being used are not your problem.

**PR description - copy this:**

```
## Brief 4 - Narration system

Works:
- ...

Does not work yet:
- ...

Run it:
cd contrib/brief-4-narration-<yourname> && pnpm install && pnpm dev

Verify output:
<paste the output of pnpm tsx scripts/verify.ts>
```

Be straight in "does not work yet". A PR that says what is broken is more useful than one that pretends, and it will not count against you.

