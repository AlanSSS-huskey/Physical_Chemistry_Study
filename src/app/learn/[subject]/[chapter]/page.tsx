import { MdxRenderer } from "@/components/MdxRenderer";
import { getMdxBySlug, renderPreview } from "@/lib/content";
import { getSession } from "@/lib/auth";
import { canAccessModule } from "@/lib/entitlements";
import { MarkCompleteForm } from "@/components/MarkCompleteForm";

export default async function ChapterPage({
  params
}: {
  params: Promise<{ subject: string; chapter: string }>;
}) {
  const { subject, chapter } = await params;
  const { frontmatter, content } = await getMdxBySlug({ subject, chapter });
  const contentSlug = `${subject}/${chapter}`;

  const session = await getSession();
  const user = session?.user as { id?: string } | undefined;

  const previewRatio = typeof frontmatter.previewRatio === "number" ? frontmatter.previewRatio : 0.2;
  const requiresModule = Boolean(frontmatter.moduleKey);
  const hasAccess =
    !requiresModule || (user?.id ? await canAccessModule({ userId: user.id, moduleKey: frontmatter.moduleKey! }) : false);

  const isPreview = requiresModule && !hasAccess;
  const rendered = isPreview ? renderPreview(content, previewRatio) : content;

  return (
    <article className="space-y-6">
      <header className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {frontmatter.subjectTitle}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {frontmatter.chapterTitle}
        </h1>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <MarkCompleteForm contentSlug={contentSlug} />
          {isPreview ? (
            <div className="rounded-md border bg-amber-50 px-3 py-2 text-sm text-amber-900">
              预览模式：免费用户仅可查看前 {Math.round(previewRatio * 100)}%。登录并获得{" "}
              <span className="font-mono">module:{frontmatter.moduleKey}</span> entitlement 可解锁全部。
            </div>
          ) : null}
        </div>
      </header>

      <MdxRenderer source={rendered} />
    </article>
  );
}

