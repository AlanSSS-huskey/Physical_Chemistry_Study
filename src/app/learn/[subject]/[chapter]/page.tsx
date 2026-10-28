import { StudyReader } from "@/components/StudyReader";

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ subject: string; chapter: string }>;
}) {
  const { subject, chapter } = await params;
  return <StudyReader slug={`${subject}/${chapter}`} />;
}
