import type { HeritagePoint } from "@/lib/types";
import { centroid, zone } from "@/content/zones/red-fort-naubat-khana";

export const naubatKhana: HeritagePoint = {
  id: "red-fort/naubat-khana",
  siteId: "red-fort",
  name: "Naubat Khana",
  nameLocal: "नौबत ख़ाना",
  tags: ["history", "architecture", "culture_traditions"],
  importance: 2,
  zone,
  centroid,
  livingTradition: {
    name: "Naubat, the drums of the hours",
    text: "A band played from the gallery above this gate at fixed hours of the day and on state occasions. The naubat was a working clock and an announcement at once, and every Mughal palace had one. The instruments survive at a few dargahs, and the shehnai and naqqara are still played at weddings, but nobody keeps the hours with them any more.",
    status: "dormant",
  },
};
