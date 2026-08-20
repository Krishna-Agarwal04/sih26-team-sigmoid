import type { HeritagePoint } from "@/lib/types";
import { centroid, zone } from "@/content/zones/red-fort-diwan-i-khas";

export const diwanIKhas: HeritagePoint = {
  id: "red-fort/diwan-i-khas",
  siteId: "red-fort",
  name: "Diwan-i-Khas",
  nameLocal: "दीवान-ए-ख़ास",
  tags: ["history", "architecture"],
  importance: 3,
  zone,
  centroid,
  livingTradition: {
    name: "Parchin kari, stone set into stone",
    text: "The lower parts of these piers are inlaid with coloured stone cut to fit sockets chiselled out of the marble, a craft the Mughals called parchin kari. It is slow work and it is still done. Workshops in Agra cut and set the same stones by hand today, mostly for tabletops and panels sold to visitors, using tools that would be recognisable to the men who worked on this hall.",
    status: "living",
  },
};
