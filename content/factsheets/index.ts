import type { FactSheet } from "@/lib/types";
import { chattaChowkFactSheet } from "./red-fort-chatta-chowk";
import { diwanIAamFactSheet } from "./red-fort-diwan-i-aam";
import { diwanIKhasFactSheet } from "./red-fort-diwan-i-khas";
import { hammamFactSheet } from "./red-fort-hammam";
import { hayatBakhshBaghFactSheet } from "./red-fort-hayat-bakhsh-bagh";
import { khasMahalFactSheet } from "./red-fort-khas-mahal";
import { lahoriGateFactSheet } from "./red-fort-lahori-gate";
import { motiMasjidFactSheet } from "./red-fort-moti-masjid";
import { mumtazMahalFactSheet } from "./red-fort-mumtaz-mahal";
import { naubatKhanaFactSheet } from "./red-fort-naubat-khana";
import { rangMahalFactSheet } from "./red-fort-rang-mahal";

export const factSheets: FactSheet[] = [
  lahoriGateFactSheet,
  chattaChowkFactSheet,
  naubatKhanaFactSheet,
  diwanIAamFactSheet,
  rangMahalFactSheet,
  khasMahalFactSheet,
  diwanIKhasFactSheet,
  hammamFactSheet,
  motiMasjidFactSheet,
  hayatBakhshBaghFactSheet,
  mumtazMahalFactSheet,
];

export function factSheetForPoint(pointId: string): FactSheet | undefined {
  return factSheets.find((f) => f.pointId === pointId);
}
