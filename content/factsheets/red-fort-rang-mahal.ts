import type { FactSheet } from "@/lib/types";

const P15 = "Zafar Hasan, List of Muhammadan and Hindu Monuments, Delhi Province, Vol. I (1916), p. 15";

export const rangMahalFactSheet: FactSheet = {
  id: "fs_red_fort_rang_mahal",
  pointId: "red-fort/rang-mahal",
  lines: [
    {
      id: "fs_rang_mahal_l1",
      text: "The building measures some 153 feet 6 inches north to south by 69 feet 3 inches east to west.",
      source: P15,
    },
    {
      id: "fs_rang_mahal_l2",
      text: "It is called the Rang Mahal from the coloured decoration with which its internal walls were originally adorned.",
      source: P15,
    },
    {
      id: "fs_rang_mahal_l3",
      text: "It was the largest of the apartments of the imperial seraglio.",
      source: P15,
    },
    {
      id: "fs_rang_mahal_l4",
      text: "In the time of Shah Jahan it was known as the Imtiyaz Mahal, the palace of distinction.",
      source: P15,
    },
    {
      id: "fs_rang_mahal_l5",
      text: "It consists of a main hall with smaller rooms at each end, and a marble water channel runs down the centre of the building.",
      source: P15,
    },
    {
      id: "fs_rang_mahal_l6",
      text: "At the centre of that channel is a marble basin cut from a single piece of stone taken from the Makrana quarries, measuring 10 feet 2 inches by 9 feet 6 inches by 2 feet 3 inches.",
      source: P15,
    },
    {
      id: "fs_rang_mahal_l7",
      text: "On the west side there is a range of underground rooms.",
      source: P15,
    },
    {
      id: "fs_rang_mahal_l8",
      text: "The building is said to have been ceiled first with silver, then with copper, and finally with wood.",
      source: P15,
    },
    {
      id: "fs_rang_mahal_l9",
      text: "Between this building and the back of the Diwan-i-Aam lay a garden with arcades around it and a tank at its centre, which was uncovered again in 1911.",
      source: P15,
    },
    {
      id: "fs_rang_mahal_l10",
      text: "The basin was taken to the Queen's Gardens after the Mutiny and returned to its present position in 1911.",
      source: "Zafar Hasan, Vol. I (1916), p. 16",
    },
    {
      id: "fs_rang_mahal_l11",
      text: "The Archaeological Survey of India lists the building as a protected monument.",
      source: P15,
    },
  ],
  sources: [
    {
      label: "Zafar Hasan, List of Muhammadan and Hindu Monuments, Delhi Province, Vol. I, 1916",
      url: "https://archive.org/details/in.ernet.dli.2015.70478",
      kind: "archive",
    },
    { label: "Archaeological Survey of India, protected monument listing", kind: "asi" },
  ],
};
