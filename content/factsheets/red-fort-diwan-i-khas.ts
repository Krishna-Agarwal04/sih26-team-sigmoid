import type { FactSheet } from "@/lib/types";

const P19 = "Zafar Hasan, List of Muhammadan and Hindu Monuments, Delhi Province, Vol. I (1916), p. 19";
const P20 = "Zafar Hasan, List of Muhammadan and Hindu Monuments, Delhi Province, Vol. I (1916), p. 20";

export const diwanIKhasFactSheet: FactSheet = {
  id: "fs_red_fort_diwan_i_khas",
  pointId: "red-fort/diwan-i-khas",
  lines: [
    {
      id: "fs_diwan_i_khas_l1",
      text: "The hall stands on the east wall of the Fort, between the Hammam and the Musamman Burj.",
      source: P19,
    },
    {
      id: "fs_diwan_i_khas_l2",
      text: "It was built between 1048 and 1058 A.H., which is 1639 to 1648 in the common era.",
      source: P19,
    },
    {
      id: "fs_diwan_i_khas_l3",
      text: "It was also known as the Shah Mahall, the royal palace.",
      source: P20,
    },
    {
      id: "fs_diwan_i_khas_l4",
      text: "The hall is 90 feet long and 67 feet wide, and stands on a plinth 4 feet 6 inches high.",
      source: P20,
    },
    {
      id: "fs_diwan_i_khas_l5",
      text: "The central chamber measures 48 feet by 27 feet, with a flat ceiling carried on engrailed arches.",
      source: P20,
    },
    {
      id: "fs_diwan_i_khas_l6",
      text: "Pietra dura inlay is used freely on the lower parts of the arch piers, while the upper parts are gilded and painted.",
      source: P20,
    },
    {
      id: "fs_diwan_i_khas_l7",
      text: "A marble water channel 12 feet wide, called the Nahr-i-Bihisht, runs through the centre of the hall.",
      source: P20,
    },
    {
      id: "fs_diwan_i_khas_l8",
      text: "The marble dais is said to have carried the peacock throne of Shah Jahan, which Nadir Shah removed in 1739.",
      source: P20,
    },
    {
      id: "fs_diwan_i_khas_l9",
      text: "Two courtyards stood in front of the hall on the west, the nearer one called the Jilau Khana, the abode of splendour, kept screened by a red curtain.",
      source: P20,
    },
    {
      id: "fs_diwan_i_khas_l10",
      text: "In this hall Nadir Shah received the submission of the Mughal Emperor Muhammad Shah.",
      source: P20,
    },
    {
      id: "fs_diwan_i_khas_l11",
      text: "Fergusson judged it, if not the most beautiful, certainly the most highly ornamented of all the buildings of Shah Jahan.",
      source: "James Fergusson, History of Indian and Eastern Architecture, Vol. II, p. 311, cited in Zafar Hasan, Vol. I (1916), p. 20",
    },
  ],
  sources: [
    {
      label: "Zafar Hasan, List of Muhammadan and Hindu Monuments, Delhi Province, Vol. I, 1916",
      url: "https://archive.org/details/in.ernet.dli.2015.70478",
      kind: "archive",
    },
    { label: "James Fergusson, History of Indian and Eastern Architecture, Vol. II", kind: "book" },
    { label: "Archaeological Survey of India, protected monument listing", kind: "asi" },
  ],
};
