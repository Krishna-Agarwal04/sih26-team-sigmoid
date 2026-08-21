import type { HeritagePoint } from "@/lib/types";
import { centroid, zone } from "@/content/zones/red-fort-lahori-gate";

export const lahoriGate: HeritagePoint = {
  id: "red-fort/lahori-gate",
  siteId: "red-fort",
  name: "Lahori Gate",
  nameLocal: "लाहौरी दरवाज़ा",
  tags: ["history", "military"],
  importance: 3,
  zone,
  centroid,
  livingTradition: {
    name: "The address from the ramparts",
    text: "Every fifteenth of August since 1947 the Prime Minister has spoken to the country from the rampart above this gate, and the flag goes up before the speech. It is the one Mughal building in Delhi whose most important use is younger than the Republic.",
    status: "living",
  },
};
