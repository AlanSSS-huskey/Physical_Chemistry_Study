"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  contentHref,
  formatDate,
  LOCALE_COOKIE,
  textFor,
  type Locale,
} from "@/lib/i18n";
import { studyRequest } from "@/lib/study-client";
import { privateLibraryQuery } from "./library-query";
import "./library-search.css";

type LibraryKind = "bookmarks" | "notes" | "recent";
type LibraryItem = {
  slug: string;
  locale: Locale;
  available: boolean;
  title: string | null;
  subjectTitle: string | null;
  updatedAt: string;
  body?: string;
  excerpt?: string;
  progress?: number;
  anchor?: string | null;
};
type LibraryData = {
  items: LibraryItem[];
  total: number;
  page: number;
  pages: number;
};

export function StudyLibrary({
  userId,
  locale,
}: {
  userId: string;
  locale: Locale;
}) {
  const { data: session, status } = useSession();
  if (status === "loading")
    return (
      <div className="study-library-loading panel" role="status">
        {textFor(locale, "正在读取学习空间…", "Loading your study workspace…")}
      </div>
    );
  if (session?.user?.id !== userId)
    return (
      <div className="notice" role="status">
        {textFor(
          locale,
          "登录账户已变化，请重新打开学习空间。",
          "Your signed-in account changed. Reopen your study workspace.",
        )}{" "}
        <a href="/account/library" className="study-text-button">
          {textFor(locale, "重新打开", "Reopen")}
        </a>
      </div>
    );
  return <OwnedStudyLibrary userId={userId} locale={locale} />;
}

function OwnedStudyLibrary({
  userId,
  locale,
}: {
  userId: string;
  locale: Locale;
}) {
  const [kind, setKind] = useState<LibraryKind>("bookmarks");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<LibraryData | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState(false);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const waitingForQuery = kind === "notes" && queryInput.trim() !== query;
  useEffect(() => {
    if (kind !== "notes") return;
    const timer = window.setTimeout(
      () => setQuery(queryInput.trim().slice(0, 200)),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [queryInput, kind]);
  useEffect(() => {
    if (waitingForQuery) {
      setPhase("loading");
      setResult(null);
      return;
    }
    const abort = new AbortController();
    setPhase("loading");
    setResult(null);
    setRemoveError(false);
    const requestUrl = privateLibraryQuery(kind, page, locale, query);
    void studyRequest<LibraryData>(
      requestUrl.pathname + requestUrl.search,
      userId,
      { signal: abort.signal },
    )
      .then((data) => {
        if (!abort.signal.aborted) {
          setResult(data);
          setPhase("ready");
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) setPhase("error");
      });
    return () => abort.abort();
  }, [kind, page, locale, userId, attempt, query, waitingForQuery]);
  async function removeBookmark(slug: string) {
    setRemoving(slug);
    setRemoveError(false);
    try {
      await studyRequest("/api/study/bookmark", userId, {
        method: "PUT",
        body: { slug, locale, bookmarked: false },
      });
      if (result?.items.length === 1 && page > 1) setPage(page - 1);
      else setAttempt((value) => value + 1);
    } catch {
      setRemoveError(true);
    } finally {
      setRemoving(null);
    }
  }
  function openLocale(contentLocale: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${contentLocale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }
  return (
    <section className="study-library-section">
      <nav
        className="study-library-tabs"
        aria-label={textFor(
          locale,
          "学习空间分类",
          "Study workspace categories",
        )}
      >
        {(
          [
            ["bookmarks", "收藏章节", "Bookmarks"],
            ["notes", "私人笔记", "Private notes"],
            ["recent", "最近阅读", "Recent reading"],
          ] as const
        ).map(([value, zh, en]) => (
          <button
            key={value}
            type="button"
            aria-current={kind === value ? "page" : undefined}
            onClick={() => {
              setKind(value);
              setPage(1);
              setQueryInput("");
              setQuery("");
            }}
          >
            {textFor(locale, zh, en)}
          </button>
        ))}
      </nav>
      {kind === "notes" && (
        <div className="private-note-search">
          <label htmlFor="private-note-search">
            {textFor(locale, "搜索笔记内容", "Search note contents")}
          </label>
          <div>
            <input
              id="private-note-search"
              type="search"
              maxLength={200}
              autoComplete="off"
              value={queryInput}
              placeholder={textFor(
                locale,
                "在自己的笔记里找一句话…",
                "Find a phrase in your own notes…",
              )}
              onChange={(event) => {
                setQueryInput(event.target.value.slice(0, 200));
                setPage(1);
              }}
            />
            {queryInput && (
              <button
                type="button"
                className="study-text-button"
                onClick={() => {
                  setQueryInput("");
                  setQuery("");
                  setPage(1);
                }}
              >
                {textFor(locale, "清空搜索", "Clear search")}
              </button>
            )}
          </div>
          <p className="study-helper">
            {textFor(
              locale,
              "仅搜索自己的笔记文字，搜索词不会进入浏览器地址栏。",
              "Searches only your own note text. Search terms stay out of the browser address bar.",
            )}
          </p>
        </div>
      )}
      <p className="study-helper">
        {textFor(
          locale,
          kind === "notes"
            ? "你的笔记仅你可见。点击章节后可继续编辑。"
            : kind === "recent"
              ? "阅读位置按中英文分别保存，阅读百分比不会自动标记为学完。"
              : "收藏在中英文版本间共享。移除收藏不会删除笔记或学习进度。",
          kind === "notes"
            ? "Your notes are private. Open a chapter to continue editing."
            : kind === "recent"
              ? "Positions are saved separately for each language. Reading percentages never mark a chapter complete."
              : "Bookmarks are shared between languages. Removing a bookmark keeps your notes and learning progress.",
        )}
      </p>
      {(phase === "loading" || waitingForQuery) && (
        <div
          className="study-library-loading panel"
          aria-busy="true"
          role="status"
        >
          {textFor(
            locale,
            kind === "notes" && queryInput.trim()
              ? "正在搜索私人笔记…"
              : "正在读取云端记录…",
            kind === "notes" && queryInput.trim()
              ? "Searching your private notes…"
              : "Loading your saved records…",
          )}
        </div>
      )}
      {phase === "error" && !waitingForQuery && (
        <div className="notice notice-error space-y-3" role="status">
          <p>
            {textFor(
              locale,
              "暂时无法读取，已有记录仍保留。",
              "Your records could not be loaded. Saved data is still retained.",
            )}
          </p>
          <button
            type="button"
            className="button-secondary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            {textFor(locale, "重试", "Try again")}
          </button>
        </div>
      )}
      {removeError && (
        <p className="notice notice-error" role="alert">
          {textFor(
            locale,
            "移除收藏失败，请重试。",
            "The bookmark could not be removed. Please try again.",
          )}
        </p>
      )}
      {phase === "ready" &&
        !waitingForQuery &&
        result &&
        (result.items.length ? (
          <>
            <p className="study-helper">
              {textFor(
                locale,
                `共 ${result.total} 条记录`,
                `${result.total} saved records`,
              )}
            </p>
            <ul className="study-library-items">
              {result.items.map((item) => (
                <li key={`${item.slug}:${item.locale}`}>
                  <div className="study-library-item-heading">
                    <div>
                      {item.available ? (
                        <a
                          href={`${contentHref(item.slug)}${item.anchor ? `#${encodeURIComponent(item.anchor)}` : ""}`}
                          onClick={() => openLocale(item.locale)}
                          className="study-library-title"
                        >
                          {item.title}
                        </a>
                      ) : (
                        <h2 className="study-library-title">
                          {textFor(
                            locale,
                            "章节暂不可用",
                            "Chapter currently unavailable",
                          )}
                        </h2>
                      )}
                      <p className="study-helper">
                        {item.available && `${item.subjectTitle} · `}
                        {item.locale === "zh" ? "中文" : "English"} ·{" "}
                        {formatDate(item.updatedAt, locale)}
                      </p>
                    </div>
                    {kind === "bookmarks" && (
                      <button
                        type="button"
                        className="study-text-button"
                        disabled={removing !== null}
                        onClick={() => {
                          void removeBookmark(item.slug);
                        }}
                      >
                        {removing === item.slug
                          ? textFor(locale, "正在移除…", "Removing…")
                          : textFor(locale, "移除收藏", "Remove")}
                      </button>
                    )}
                  </div>
                  {item.excerpt !== undefined && (
                    <p className="study-note-excerpt">{item.excerpt}</p>
                  )}
                  {item.body !== undefined && (
                    <details className="study-note-full">
                      <summary>
                        {textFor(
                          locale,
                          "查看完整笔记",
                          "Read full private note",
                        )}
                      </summary>
                      <pre>{item.body}</pre>
                    </details>
                  )}
                  {item.progress !== undefined && (
                    <p className="study-helper">
                      {textFor(
                        locale,
                        `阅读位置 ${Math.round(item.progress * 100)}%`,
                        `Reading position ${Math.round(item.progress * 100)}%`,
                      )}
                    </p>
                  )}
                  {!item.available && (
                    <p className="study-helper">
                      {textFor(
                        locale,
                        "你的记录仍保留，当前无法打开该章节。",
                        "Your record is retained, but this chapter cannot currently be opened.",
                      )}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {result.pages > 1 && (
              <nav
                className="study-library-pagination"
                aria-label={textFor(locale, "分页", "Pagination")}
              >
                <button
                  className="button-secondary"
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  {textFor(locale, "上一页", "Previous")}
                </button>
                <span>
                  {page} / {result.pages}
                </span>
                <button
                  className="button-secondary"
                  type="button"
                  disabled={page >= result.pages}
                  onClick={() => setPage(page + 1)}
                >
                  {textFor(locale, "下一页", "Next")}
                </button>
              </nav>
            )}
          </>
        ) : (
          <div className="panel study-library-empty">
            <h2>
              {textFor(
                locale,
                kind === "notes" && query
                  ? "没有找到匹配的笔记"
                  : kind === "notes"
                    ? "把理解写成自己的话"
                    : kind === "recent"
                      ? "从一章开始，留下阅读位置"
                      : "给值得重读的章节留个位置",
                kind === "notes" && query
                  ? "No matching private notes"
                  : kind === "notes"
                    ? "Put an idea into your own words"
                    : kind === "recent"
                      ? "A place to pick up where you left off"
                      : "Keep a chapter worth returning to",
              )}
            </h2>
            <p className="muted">
              {textFor(
                locale,
                kind === "notes" && query
                  ? "试试更短的关键词，或清空搜索查看全部私人笔记。"
                  : kind === "notes"
                    ? "在任意可阅读的章节展开“我的本章笔记”，这里会自动汇集。"
                    : kind === "recent"
                      ? "打开章节并开始阅读，位置会自动同步到这里。"
                      : "阅读时选择“收藏本章”，即可在这里找到它。",
                kind === "notes" && query
                  ? "Try a shorter phrase, or clear the search to see all your private notes."
                  : kind === "notes"
                    ? "Open “My chapter notes” in any readable chapter. Your saved notes will appear here."
                    : kind === "recent"
                      ? "Open a chapter and start reading. Your position will sync here automatically."
                      : "Choose “Bookmark chapter” while reading to find it here again.",
              )}
            </p>
            {kind === "notes" && query ? (
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setQueryInput("");
                  setQuery("");
                  setPage(1);
                }}
              >
                {textFor(locale, "查看全部私人笔记", "Show all private notes")}
              </button>
            ) : (
              <Link href="/learn" className="button-secondary">
                {textFor(locale, "浏览章节", "Browse chapters")}
              </Link>
            )}
          </div>
        ))}
    </section>
  );
}
