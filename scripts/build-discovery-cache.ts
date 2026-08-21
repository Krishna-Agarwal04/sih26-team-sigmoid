import { mkdir, readFile, writeFile } from "node:fs/promises";
import { ANCHORS } from "@/content/anchors";
import type { BaselineFeature } from "@/lib/discovery/baseline";
import { buildCandidates } from "@/lib/discovery/candidates";
import { extractMentions } from "@/lib/discovery/extract";
import type { AnalyseResult } from "@/lib/types";

// The cache is the fallback the demo leans on, so it is built before the screen that reads it.
// plan/05 decision 6. Run with: npx tsx --env-file=.env.local scripts/build-discovery-cache.ts

const VOLUME_ID = "zafar-hasan-v2";
const OUT_DIR = "content/discovery-cache";

// the Groq free tier allows 8000 tokens a minute and one Page costs roughly 1800
const PAUSE_MS = 15_000;

interface Page {
  pageNo: number;
  printedPageNo: number | null;
  imageUrl: string;
  clueScore: number;
  text: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const volume = JSON.parse(await readFile(`content/pages/${VOLUME_ID}.json`, "utf8")) as { pages: Page[] };
  const baseline = JSON.parse(await readFile("content/baseline.geojson", "utf8")) as { features: BaselineFeature[] };
  await mkdir(OUT_DIR, { recursive: true });

  const only = process.argv[2] ? Number(process.argv[2]) : null;
  const pages = only ? volume.pages.filter((p) => p.pageNo === only) : volume.pages;

  let done = 0;
  let failed = 0;

  for (const page of pages) {
    const extracted = await extractMentions(page.pageNo, page.text);
    if (!extracted.ok) {
      failed++;
      console.log(`p${page.pageNo}  FAILED  ${extracted.reason}`);
      await sleep(PAUSE_MS);
      continue;
    }

    const { mentions, modelId } = extracted.extraction;
    const candidates = buildCandidates({ mentions, anchors: ANCHORS, baseline: baseline.features, volumeId: VOLUME_ID });
    const result: AnalyseResult = { source: "cached", modelId, pageNo: page.pageNo, mentions, candidates };

    await writeFile(`${OUT_DIR}/${VOLUME_ID}-${page.pageNo}.json`, JSON.stringify(result, null, 1) + "\n");
    done++;

    const by = (v: string) => candidates.filter((c) => c.evidence.baselineVerdict === v).length;
    const lost = mentions.filter((m) => m.passageOffset[1] === 0).length;
    console.log(
      `p${page.pageNo}	${mentions.length} mentions	${candidates.length} placed	` +
        `${by("representation_gap")} gap	${by("matched_existing")} matched	${by("inconclusive")} unclear	` +
        `${mentions.length - candidates.length} partial	${lost} unhighlighted`,
    );
    await sleep(PAUSE_MS);
  }

  console.log(`\nwrote ${done} Pages, ${failed} failed`);
}

main();
