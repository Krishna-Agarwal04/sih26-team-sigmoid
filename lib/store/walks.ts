import { storeClient } from "./client";
import type { WalkCrossingInput } from "@/lib/types";

export async function recordCrossing(crossing: WalkCrossingInput): Promise<boolean> {
  const client = storeClient();
  if (client === null) return false;

  const { error } = await client.from("walk_crossings").insert({
    walk_id: crossing.walkId,
    point_id: crossing.pointId,
    site_id: crossing.siteId,
    persona: crossing.persona,
    kind: crossing.kind,
    location_source: crossing.locationSource,
  });

  // a Walk must never stall on its own logging, so a failure is reported and swallowed here
  if (error) {
    console.error("walk_crossings insert failed:", error.message);
    return false;
  }
  return true;
}
