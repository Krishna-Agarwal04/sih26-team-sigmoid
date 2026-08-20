import type { FactSheet } from "@/lib/types";
import { diwanIAamFactSheet } from "./red-fort-diwan-i-aam";
import { diwanIKhasFactSheet } from "./red-fort-diwan-i-khas";
import { rangMahalFactSheet } from "./red-fort-rang-mahal";

export const factSheets: FactSheet[] = [diwanIAamFactSheet, rangMahalFactSheet, diwanIKhasFactSheet];

export function factSheetForPoint(pointId: string): FactSheet | undefined {
  return factSheets.find((f) => f.pointId === pointId);
}
