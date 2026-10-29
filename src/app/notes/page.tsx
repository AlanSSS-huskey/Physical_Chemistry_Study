import { getLocale } from "@/lib/locale-server";
import { textFor } from "@/lib/i18n";
import { loadLibrary } from "@/lib/content-service";
import { ContentCard } from "@/components/ContentCard";
import { ServiceNotice } from "@/components/ServiceNotice";
import Link from "next/link";
import { getSessionState } from "@/lib/auth";
import { searchStudyLibrary } from "@/lib/search-service";
import { SearchResultLink } from "@/components/SearchResultLink";

export default async function NotesIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; subject?: string }>;
}) {
  const locale = await getLocale();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 200).trim() : "";
  const subject = typeof params.subject === "string" ? params.subject : "";
  const { items, databaseAvailable } = await loadLibrary(locale);
  const subjects = [
    ...new Map(
      items.map((item) => [item.subjectSlug, item.subjectTitle]),
    ).entries(),
  ];
  const filtered = items.filter(
    (item) =>
      (!subject || item.subjectSlug === subject) &&
      (!q ||
        `${item.title} ${item.subjectTitle}`
          .toLocaleLowerCase()
          .includes(q.toLocaleLowerCase())),
  );
  let searchResult: Awaited<ReturnType<typeof searchStudyLibrary>> | null =
    null;
  let searchUnavailable = false;
  if (q) {
    try {
      const session = await getSessionState();
      if (session.status === "unavailable")
        throw new Error("Search unavailable");
      searchResult = await searchStudyLibrary(
        q,
        locale,
        session.status === "authenticated" ? session.user.id : undefined,
        subject,
      );
      if (!searchResult.databaseAvailable) searchUnavailable = true;
    } catch {
      searchUnavailable = true;
    }
  }
  return (
    <div className="space-y-8">
      <header className="page-intro">
        <span className="eyebrow">NOTES & EXPLANATIONS</span>
        <h1 className="page-heading">
          {textFor(locale, "知识从这里连接。", "Ideas, connected.")}
        </h1>
        <p className="muted">
          {textFor(
            locale,
            "寻找一个概念，或打开一篇笔记慢慢读。",
            "Find a concept, or settle into a note and take your time.",
          )}
        </p>
      </header>
      <form className="library-search" action="/notes">
        <label htmlFor="note-search" className="sr-only">
          {textFor(locale, "搜索笔记", "Search notes")}
        </label>
        <span aria-hidden="true">⌕</span>
        <input
          id="note-search"
          name="q"
          defaultValue={q}
          placeholder={textFor(
            locale,
            "搜索中英文标题、概念或正文…",
            "Search Chinese & English titles, concepts or text…",
          )}
          type="search"
          maxLength={200}
        />
        <label htmlFor="subject-filter" className="sr-only">
          {textFor(locale, "按学科筛选", "Filter by subject")}
        </label>
        <select id="subject-filter" name="subject" defaultValue={subject}>
          <option value="">
            {textFor(locale, "全部学科", "All subjects")}
          </option>
          {subjects.map(([slug, title]) => (
            <option key={slug} value={slug}>
              {title}
            </option>
          ))}
        </select>
        <button className="button" type="submit">
          {textFor(locale, "搜索", "Search")}
        </button>
      </form>
      {!databaseAvailable && <ServiceNotice locale={locale} />}
      <div className="section-header">
        <h2 className="section-heading">
          {q
            ? textFor(locale, "搜索结果", "Search results")
            : textFor(locale, "全部笔记", "All notes")}
        </h2>
        <span className="muted">
          {q ? searchResult?.hits.length || 0 : filtered.length}{" "}
          {textFor(locale, "篇笔记", "notes")}
        </span>
      </div>
      {q && searchUnavailable && (
        <p className="notice" role="status">
          {textFor(
            locale,
            "搜索服务未完整连接，以下结果可能不完整，请稍后重试。",
            "Search is not fully connected. Results may be incomplete; please try again shortly.",
          )}
        </p>
      )}
      {q ? (
        <div className="search-results">
          {searchResult?.hits.map((hit) => (
            <article className="search-result" key={hit.slug}>
              <div className="search-result-meta">
                <span>{hit.subjectTitle}</span>
                <span className="badge">
                  {hit.locale === "zh" ? "中文" : "English"}
                </span>
              </div>
              <h3>
                <SearchResultLink href={hit.href} locale={hit.locale}>
                  {hit.title}
                  <span aria-hidden="true"> ↗</span>
                </SearchResultLink>
              </h3>
              <p>{hit.snippet}</p>
              <span className="auth-hint">
                {textFor(locale, "打开匹配的段落", "Open the matching section")}
              </span>
            </article>
          ))}
        </div>
      ) : (
        <div className="content-grid">
          {filtered.map((item, index) => (
            <ContentCard
              key={item.slug}
              content={item}
              locale={locale}
              index={index}
            />
          ))}
        </div>
      )}
      {!(q ? searchResult?.hits.length || 0 : filtered.length) &&
        !searchUnavailable && (
          <div className="empty-state panel">
            <h2>
              {textFor(locale, "没有找到匹配的笔记", "No matching notes")}
            </h2>
            <p className="muted">
              {textFor(
                locale,
                "试试更短的关键词，或者浏览全部内容。",
                "Try a shorter search, or browse the full collection.",
              )}
            </p>
            <Link className="button-secondary" href="/notes">
              {textFor(locale, "清除筛选", "Clear filters")}
            </Link>
          </div>
        )}
    </div>
  );
}
