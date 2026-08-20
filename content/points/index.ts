import type { HeritagePoint } from "@/lib/types";
import { diwanIAam } from "./red-fort/diwan-i-aam";
import { diwanIKhas } from "./red-fort/diwan-i-khas";
import { rangMahal } from "./red-fort/rang-mahal";

// visitor order, west to east
export const points: HeritagePoint[] = [diwanIAam, rangMahal, diwanIKhas];

export function pointById(id: string): HeritagePoint | undefined {
  return points.find((p) => p.id === id);
}

export function pointsBySite(siteId: string): HeritagePoint[] {
  return points.filter((p) => p.siteId === siteId);
}
