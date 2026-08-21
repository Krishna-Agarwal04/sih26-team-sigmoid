import { notFound } from "next/navigation";
import { pointsBySite } from "@/content/points";
import { siteById, sites } from "@/content/sites";
import PlanForm from "./plan-form";

export function generateStaticParams() {
  return sites.filter((s) => s.pointIds.length > 0).map((s) => ({ slug: s.id }));
}

export default async function PlanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = siteById(slug);
  if (!site || pointsBySite(slug).length === 0) notFound();

  return <PlanForm site={site} />;
}
