import Link from "next/link";
import { notFound } from "next/navigation";
import { loadContent, loadLibrary } from "@/lib/content-service";
import { resolveContentAccess } from "@/lib/content-access";
import { getSessionState } from "@/lib/auth";
import { getLocale } from "@/lib/locale-server";
import { contentHref, formatDate, textFor } from "@/lib/i18n";
import { renderPreview } from "@/lib/content";
import { MdxRenderer } from "@/components/MdxRenderer";
import { MarkCompleteForm } from "@/components/MarkCompleteForm";
import { ServiceNotice } from "@/components/ServiceNotice";
import { isContentSlug } from "@/lib/content-validation";
import { contentLookupOutcome } from "@/lib/reading-state";
import { StudyWorkspace } from "@/components/study/StudyWorkspace";
import { ChapterToc } from "@/components/navigation/ChapterToc";

export async function StudyReader({ slug }: { slug: string }) {
  if (!isContentSlug(slug)) notFound();
  const locale = await getLocale();
  const [{ content, databaseAvailable }, library, session] = await Promise.all([
    loadContent(slug, locale),
    loadLibrary(locale),
    getSessionState(),
  ]);
  if (!content) {
    const bundledMode =
      process.env.CHEMISTRY_CONTENT_MODE === "bundled" ||
      !process.env.DATABASE_URL?.trim();
    if (
      contentLookupOutcome(false, databaseAvailable, bundledMode) ===
      "unavailable"
    )
      return (
        <div className="empty-state panel space-y-5">
          <h1 className="section-heading">
            {textFor(
              locale,
              "暂时无法加载这篇笔记",
              "This note could not be loaded",
            )}
          </h1>
          <ServiceNotice locale={locale} />
          <Link className="button-secondary" href="/learn">
            {textFor(locale, "查看可用课程", "View available lessons")}
          </Link>
        </div>
      );
    notFound();
  }
  let access;
  try {
    access = await resolveContentAccess(
      content,
      session.status === "authenticated" ? session.user.id : undefined,
    );
  } catch {
    return (
      <div className="panel space-y-5">
        <h1 className="section-heading">
          {textFor(
            locale,
            "暂时无法验证阅读权限",
            "Reading access could not be verified",
          )}
        </h1>
        <p className="muted">
          {textFor(
            locale,
            "请稍后重新加载，或返回学习中心。",
            "Please reload shortly, or return to the study library.",
          )}
        </p>
        <Link href="/learn" className="button-secondary">
          {textFor(locale, "返回学习中心", "Back to the library")}
        </Link>
      </div>
    );
  }
  if (access === "denied" && (!content.isPublic || !content.isPublished))
    notFound();
  const chapters = library.items.filter(
    (item) => item.subjectSlug === content.subjectSlug,
  );
  const index = chapters.findIndex((item) => item.slug === content.slug);
  const previous = index > 0 ? chapters[index - 1] : null;
  const next = index >= 0 ? chapters[index + 1] : null;
  const readingMinutes = Math.max(
    1,
    Math.ceil(
      content.sourceLocale === "zh"
        ? content.body.replace(/\s/g, "").length / 400
        : content.body.split(/\s+/).length / 200,
    ),
  );
  const body =
    access === "full"
      ? content.body
      : access === "preview"
        ? renderPreview(content.body, content.previewRatio)
        : "";
  const navigation = (
    <nav aria-label={textFor(locale, "章节目录", "Chapter navigation")}>
      <Link href="/learn" className="eyebrow">
        ← {textFor(locale, "学习中心", "STUDY LIBRARY")}
      </Link>
      <h2>{content.subjectTitle}</h2>
      <ol>
        {chapters.map((item, i) => (
          <li key={item.slug}>
            <Link
              href={contentHref(item.slug)}
              aria-current={item.slug === content.slug ? "page" : undefined}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              {item.title}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
  return (
    <div className="reader-layout">
      <aside className="reader-sidebar">
        <div className="desktop-reader-nav">{navigation}</div>
        <details className="mobile-reader-nav">
          <summary>
            {textFor(locale, "本学科章节目录", "Chapters in this subject")}
          </summary>
          {navigation}
        </details>
        <ChapterToc
          locale={locale}
          contentKey={`${content.slug}:${content.sourceLocale}`}
        />
      </aside>
      <article className="reader-article">
        <nav
          className="breadcrumbs"
          aria-label={textFor(locale, "面包屑导航", "Breadcrumb")}
        >
          <Link href="/learn">
            {textFor(locale, "学习中心", "Study library")}
          </Link>
          <span aria-hidden="true">/</span>
          <span>{content.subjectTitle}</span>
        </nav>
        <header className="reader-heading">
          <span className="eyebrow">
            {textFor(locale, "学习笔记", "STUDY NOTES")}
            {index >= 0 ? ` / ${String(index + 1).padStart(2, "0")}` : ""}
          </span>
          <h1 lang={content.sourceLocale === "zh" ? "zh-CN" : "en"}>
            {content.title}
          </h1>
          <div className="reader-meta">
            <span>
              {readingMinutes} {textFor(locale, "分钟阅读", "min read")}
            </span>
            <span>·</span>
            <span>{content.sourceLocale === "zh" ? "中文" : "English"}</span>
            {content.updatedAt && (
              <>
                <span>·</span>
                <span>{formatDate(content.updatedAt, locale)}</span>
              </>
            )}
          </div>
        </header>
        {!databaseAvailable && <ServiceNotice locale={locale} />}
        {!content.translationAvailable && (
          <div className="notice" role="status">
            {textFor(
              locale,
              "本章暂无中文译文，以下显示英文原文。",
              "An English translation is not available for this chapter yet. The original Chinese text is shown below.",
            )}
          </div>
        )}
        {access !== "full" && (
          <div className="notice space-y-3">
            <p>
              {access === "preview"
                ? textFor(
                    locale,
                    `你正在阅读本章的 ${Math.round(content.previewRatio * 100)}% 预览。完整内容需要相应阅读权限。`,
                    `You are reading a ${Math.round(content.previewRatio * 100)}% preview. Full content requires reading access.`,
                  )
                : textFor(
                    locale,
                    "本章需要阅读权限。",
                    "Reading access is required for this chapter.",
                  )}
            </p>
            <Link
              href={
                session.status === "authenticated"
                  ? "/account"
                  : `/login?callbackUrl=${encodeURIComponent(contentHref(content.slug))}`
              }
              className="button-secondary"
            >
              {textFor(
                locale,
                session.status === "authenticated"
                  ? "查看我的账户"
                  : "登录查看权限",
                session.status === "authenticated"
                  ? "View my account"
                  : "Sign in to check access",
              )}
            </Link>
          </div>
        )}
        <StudyWorkspace
          key={`${session.status === "authenticated" ? session.user.id : "anonymous"}:${content.slug}:${content.sourceLocale}`}
          slug={content.slug}
          locale={content.sourceLocale}
          authenticatedUserId={
            session.status === "authenticated" ? session.user.id : undefined
          }
          canRead={access === "full"}
        />
        <div
          data-study-body
          lang={content.sourceLocale === "zh" ? "zh-CN" : "en"}
        >
          <MdxRenderer source={body} />
        </div>
        {access === "full" && (
          <section className="reader-completion">
            <div>
              <span className="eyebrow">
                {textFor(locale, "把理解留在这里", "MAKE IT COUNT")}
              </span>
              <h2>
                {textFor(
                  locale,
                  "准备好进入下一章了吗？",
                  "Ready for the next idea?",
                )}
              </h2>
              <p className="muted">
                {textFor(
                  locale,
                  "检查你能否解释关键概念，再记录本章的完成状态。",
                  "Check that you can explain the key ideas, then record your completion.",
                )}
              </p>
            </div>
            <MarkCompleteForm contentSlug={content.slug} />
          </section>
        )}
        <nav
          className="chapter-pagination"
          aria-label={textFor(locale, "相邻章节", "Adjacent chapters")}
        >
          {previous ? (
            <Link href={contentHref(previous.slug)}>
              <span className="eyebrow">
                ← {textFor(locale, "上一章", "PREVIOUS")}
              </span>
              <strong>{previous.title}</strong>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={contentHref(next.slug)} className="next-chapter">
              <span className="eyebrow">
                {textFor(locale, "下一章", "NEXT")} →
              </span>
              <strong>{next.title}</strong>
            </Link>
          ) : (
            <Link className="next-chapter" href="/learn">
              <span className="eyebrow">
                {textFor(locale, "继续探索", "KEEP EXPLORING")} →
              </span>
              <strong>
                {textFor(locale, "回到学习中心", "Back to the library")}
              </strong>
            </Link>
          )}
        </nav>
      </article>
    </div>
  );
}
