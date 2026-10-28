import Link from "next/link";
import { getLocale } from "@/lib/locale-server";
import { textFor } from "@/lib/i18n";
import { loadLibrary } from "@/lib/content-service";
import { ContentCard } from "@/components/ContentCard";
import { ScientificFigure } from "@/components/ScientificFigure";
import { ServiceNotice } from "@/components/ServiceNotice";

export default async function HomePage() {
  const locale = await getLocale();
  const { items, databaseAvailable } = await loadLibrary(locale);
  const subjects = new Set(items.map((item) => item.subjectSlug));
  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="hero-copy">
          <div className="eyebrow hero-eyebrow">
            <span className="small-line" />
            {textFor(
              locale,
              "物理化学 · 双语学习空间",
              "PHYSICAL CHEMISTRY · A BILINGUAL STUDY SPACE",
            )}
          </div>
          <h1>
            {textFor(locale, "让公式背后的", "Make sense of")}
            <br />
            <em>
              {textFor(locale, "世界，清晰起来。", "the science behind it.")}
            </em>
          </h1>
          <p className="hero-description">
            {textFor(
              locale,
              "从热力学的基本概念，到一步步的公式推导。用中英文笔记、例题和练习，建立真正连贯的理解。",
              "From the foundations of thermodynamics to step-by-step derivations. Build a connected understanding with bilingual notes, worked examples and practice.",
            )}
          </p>
          <div className="hero-actions">
            <Link href="/learn" className="button">
              {textFor(locale, "开始学习", "Explore the library")}
              <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/notes" className="text-link">
              {textFor(locale, "浏览全部笔记", "Browse all notes")}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="hero-footnote">
            <span className="status-dot" />
            {textFor(
              locale,
              "公开阅读 · 中英切换 · 循序渐进",
              "Open lessons · Two languages · Step by step",
            )}
          </div>
        </div>
        <ScientificFigure locale={locale} />
      </section>
      <div className="facts-strip">
        <div>
          <strong>{String(items.length).padStart(2, "0")}</strong>
          <span>{textFor(locale, "可阅读章节", "Available chapters")}</span>
        </div>
        <div>
          <strong>{String(subjects.size).padStart(2, "0")}</strong>
          <span>{textFor(locale, "学科主题", "Subject areas")}</span>
        </div>
        <div>
          <strong>中 / EN</strong>
          <span>{textFor(locale, "双语学习", "Bilingual by design")}</span>
        </div>
        <p>
          {textFor(
            locale,
            "先理解为什么，再记住是什么。",
            "Understand the why. Remember the what.",
          )}
        </p>
      </div>
      {!databaseAvailable && <ServiceNotice locale={locale} />}
      <section className="home-library">
        <div className="section-header">
          <div>
            <div className="eyebrow">THE STUDY LIBRARY</div>
            <h2>{textFor(locale, "从这里开始", "A good place to begin")}</h2>
          </div>
          <Link className="text-link" href="/learn">
            {textFor(locale, "查看学习中心", "View the library")}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="content-grid">
          {items.slice(0, 4).map((item, index) => (
            <ContentCard
              key={item.slug}
              content={item}
              locale={locale}
              index={index}
            />
          ))}
        </div>
        {!items.length && (
          <div className="panel muted">
            {textFor(
              locale,
              "课程正在整理中，请稍后再来。",
              "Lessons are being prepared. Please check back soon.",
            )}
          </div>
        )}
      </section>
      <section className="learning-principles">
        <div>
          <span className="eyebrow">01 / UNDERSTAND</span>
          <h3>{textFor(locale, "把概念讲明白", "Start with understanding")}</h3>
          <p>
            {textFor(
              locale,
              "先建立物理图像，再引入定义、假设和公式。",
              "Build a physical picture before introducing definitions, assumptions and equations.",
            )}
          </p>
        </div>
        <div>
          <span className="eyebrow">02 / CONNECT</span>
          <h3>{textFor(locale, "把知识连起来", "Connect the ideas")}</h3>
          <p>
            {textFor(
              locale,
              "同一章节切换中英文，术语、推导和学习位置保持连贯。",
              "Switch languages within a chapter while keeping your terminology, context and place.",
            )}
          </p>
        </div>
        <div>
          <span className="eyebrow">03 / PRACTISE</span>
          <h3>{textFor(locale, "让理解经得起练习", "Put it into practice")}</h3>
          <p>
            {textFor(
              locale,
              "用例题检查符号、单位和条件，再保存你的学习进度。",
              "Check signs, units and assumptions with worked examples, then save your progress.",
            )}
          </p>
        </div>
      </section>
    </div>
  );
}
