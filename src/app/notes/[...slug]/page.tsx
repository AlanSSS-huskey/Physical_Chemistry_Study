import { StudyReader } from "@/components/StudyReader";
import { noteSlugFromSegments } from "@/lib/content-validation";
import { notFound } from "next/navigation";

export default async function NotePage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const contentSlug = noteSlugFromSegments(slug);
  if (!contentSlug) notFound();
  return <StudyReader slug={contentSlug} />;
}
