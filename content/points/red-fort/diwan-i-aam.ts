import type { HeritagePoint } from "@/lib/types";
import { centroid, zone } from "@/content/zones/red-fort-diwan-i-aam";

export const diwanIAam: HeritagePoint = {
  id: "red-fort/diwan-i-aam",
  siteId: "red-fort",
  name: "Diwan-i-Aam",
  nameLocal: "दीवान-ए-आम",
  tags: ["history", "architecture"],
  importance: 3,
  zone,
  centroid,
  livingTradition: {
    name: "Darshan from the jharokha",
    text: "Every morning the Emperor showed himself to whoever had come, from a balcony above this hall, and the day could not begin until he did. Anyone could stand in the court below and be seen. The Mughal court ended in 1857 and the daily appearance ended with it, though it was staged once more in December 1911 for George V.",
    status: "lost",
  },
};
