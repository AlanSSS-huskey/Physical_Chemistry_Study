import Link from "next/link";
import type { StudyContent } from "@/lib/content-service";
import { contentHref, textFor, type Locale } from "@/lib/i18n";

export function ContentCard({
  content,
  locale,
  index = 0,
}: {
  content: StudyContent;
  locale: Locale;
  index?: number;
}) {
  return (
    <Link className="content-card" href={contentHref(content.slug)}>
      <div className="content-card-top">
        <span className="eyebrow">{content.subjectTitle}</span>
        <span className="chapter-number">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <h3>{content.title}</h3>
      <div className="content-card-bottom">
        <span>
          {textFor(
            locale,
            "概念 · 推导 · 练习",
            "Concepts · Derivations · Practice",
          )}
        </span>
        <span className="card-arrow" aria-hidden="true">
          ↗
        </span>
      </div>
    </Link>
  );
}
