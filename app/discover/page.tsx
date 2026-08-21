import volume from "@/content/pages/zafar-hasan-v2.json";
import Discover from "./discover";

export const metadata = { title: "Discover - THRESHOLD" };

export default function DiscoverPage() {
  return (
    <Discover
      volumeId={volume.volumeId}
      title={volume.title}
      sourceUrl={volume.sourceUrl}
      licence={volume.licence}
      pages={volume.pages.map((p) => ({
        pageNo: p.pageNo,
        printedPageNo: p.printedPageNo,
        imageUrl: p.imageUrl,
        clueScore: p.clueScore,
        text: p.text,
      }))}
    />
  );
}
