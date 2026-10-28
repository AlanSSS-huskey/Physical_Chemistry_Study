import Link from "next/link";
import { getLocale } from "@/lib/locale-server";
import { textFor, contentHref } from "@/lib/i18n";
import { loadLibrary } from "@/lib/content-service";
import { ServiceNotice } from "@/components/ServiceNotice";

export default async function LearnIndexPage() {
  const locale = await getLocale();
  const { items, databaseAvailable } = await loadLibrary(locale);
  const groups = new Map<string, typeof items>();
  for (const item of items)
    groups.set(item.subjectSlug, [
      ...(groups.get(item.subjectSlug) ?? []),
      item,
    ]);
  return (
    <div className="space-y-8">
      <header className="page-intro">
        <div className="eyebrow">YOUR STUDY LIBRARY</div>
        <h1 className="page-heading">
          {textFor(locale, "学习中心", "The study library")}
        </h1>
        <p className="muted">
          {textFor(
            locale,
            "按章节循序渐进，也可以从最感兴趣的概念开始。",
            "Follow a chapter at a time, or start with the concept you are curious about.",
          )}
        </p>
      </header>
      {!databaseAvailable && <ServiceNotice locale={locale} />}
      {[...groups].map(([subject, chapters], index) => (
        <section key={subject} className="subject-section">
          <div className="subject-heading">
            <span className="subject-index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <div className="eyebrow">{subject.replaceAll("-", " ")}</div>
              <h2>{chapters[0].subjectTitle}</h2>
              <p className="muted">
                {chapters.length}{" "}
                {textFor(
                  locale,
                  "个章节 · 中英双语",
                  "chapters · Chinese & English",
                )}
              </p>
            </div>
          </div>
          <ol className="chapter-list">
            {chapters.map((chapter, i) => (
              <li key={chapter.slug}>
                <Link href={contentHref(chapter.slug)}>
                  <span className="chapter-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3>{chapter.title}</h3>
                    <span className="muted">
                      {textFor(locale, "阅读章节", "Read chapter")}
                      {!chapter.translationAvailable &&
                        ` · ${textFor(locale, "原文版本", "Original language")}`}
                    </span>
                  </div>
                  <span className="card-arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
      {!items.length && (
        <div className="panel muted">
          {textFor(
            locale,
            "还没有发布的课程。",
            "No lessons have been published yet.",
          )}
        </div>
      )}
    </div>
  );
}
