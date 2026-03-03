import { MdxRenderer } from "@/components/MdxRenderer";
import { getMdxBySlug } from "@/lib/content";

export default async function ChapterPage({
  params
}: {
  params: Promise<{ subject: string; chapter: string }>;
}) {
  const { subject, chapter } = await params;
  const { frontmatter, content } = await getMdxBySlug({ subject, chapter });

  return (
    <article className="space-y-6">
      <header className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {frontmatter.subjectTitle}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {frontmatter.chapterTitle}
        </h1>
        <p className="text-sm text-zinc-700">
          MVP：公开可见。后续会在这里接入 entitlement 权限（示例：免费仅预览前 20%）。
        </p>
      </header>

      <MdxRenderer source={content} />
    </article>
  );
}

