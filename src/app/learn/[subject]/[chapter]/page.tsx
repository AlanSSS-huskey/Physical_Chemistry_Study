import { MdxRenderer } from "@/components/MdxRenderer";
import { ContentNotFoundError, getMdxBySlug, renderPreview } from "@/lib/content";
import { getCurrentUser } from "@/lib/auth";
import { canAccessModule } from "@/lib/entitlements";
import { MarkCompleteForm } from "@/components/MarkCompleteForm";
import { notFound } from "next/navigation";

export default async function ChapterPage({
  params
}: {
  params: Promise<{ subject: string; chapter: string }>;
}) {
  const { subject, chapter } = await params;
  const decodedSubject = decodeURIComponent(subject);
  const decodedChapter = decodeURIComponent(chapter);
  let frontmatter;
  let content;

  try {
    const mdx = await getMdxBySlug({
      subject: decodedSubject,
      chapter: decodedChapter
    });
    frontmatter = mdx.frontmatter;
    content = mdx.content;
  } catch (error) {
    if (error instanceof ContentNotFoundError) {
      notFound();
    }
    throw error;
  }

  const contentSlug = `${decodedSubject}/${decodedChapter}`;

  const user = await getCurrentUser();

  const previewRatio =
    typeof frontmatter.previewRatio === "number" ? frontmatter.previewRatio : 0.2;
  const requiresModule = Boolean(frontmatter.moduleKey);
  const hasAccess =
    !requiresModule ||
    (user?.id
      ? await canAccessModule({ userId: user.id, moduleKey: frontmatter.moduleKey! })
      : false);

  const isPreview = requiresModule && !hasAccess;
  const rendered = isPreview ? renderPreview(content, previewRatio) : content;

  return (
    <article className="space-y-6">
      <header className="sticky top-20 z-20 space-y-3 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur">
        <div className="text-xs font-black uppercase tracking-wider text-blue-700">
          {frontmatter.subjectTitle}
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">
          {frontmatter.chapterTitle}
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <MarkCompleteForm contentSlug={contentSlug} />
          {isPreview ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              预览模式：免费用户仅可查看前 {Math.round(previewRatio * 100)}%。登录并获得{" "}
              <span className="font-mono">module:{frontmatter.moduleKey}</span> entitlement 可解锁全部。
            </div>
          ) : null}
        </div>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <MdxRenderer source={rendered} />
      </div>
    </article>
  );
}
