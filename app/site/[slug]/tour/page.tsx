import { notFound } from "next/navigation";
import { factSheets } from "@/content/factsheets";
import { pointsBySite } from "@/content/points";
import { siteById, sites } from "@/content/sites";
import { narrations } from "@/lib/narration/catalogue";
import Tour from "./tour";

export function generateStaticParams() {
  return sites.filter((s) => s.pointIds.length > 0).map((s) => ({ slug: s.id }));
}

export default async function TourPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = siteById(slug);
  const points = pointsBySite(slug);
  if (!site || points.length === 0) notFound();

  return (
    <Tour
      site={site}
      points={points}
      narrations={narrations.filter((n) => n.kind === "approach")}
      factSheets={factSheets}
    />
  );
}
