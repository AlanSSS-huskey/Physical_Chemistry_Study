"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { SearchResultLink } from "@/components/SearchResultLink";
import { textFor } from "@/lib/i18n";
import { focusLoopTarget, searchShortcut } from "@/lib/navigation-search";
import { useNavigationSearch } from "./useNavigationSearch";

export function QuickSearch() {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  const { data: session } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const results = useRef<HTMLUListElement>(null);
  const allResults = useRef<HTMLAnchorElement>(null);
  const search = useNavigationSearch(
    open,
    query,
    locale,
    session?.user?.id ?? "anonymous",
  );
  function show() {
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : trigger.current;
    setOpen(true);
  }
  function close() {
    dialog.current?.close();
    setOpen(false);
  }
  useEffect(() => {
    const shortcut = (event: globalThis.KeyboardEvent) => {
      if (!searchShortcut(event)) return;
      event.preventDefault();
      if (dialog.current?.open) input.current?.focus();
      else {
        opener.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : trigger.current;
        setOpen(true);
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    setOpen(false);
    dialog.current?.close();
  }, [pathname, locale, session?.user?.id]);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const returnTarget = opener.current?.isConnected
      ? opener.current
      : trigger.current;
    element?.showModal();
    input.current?.focus();
    return () => {
      element?.close();
      if (returnTarget?.isConnected)
        returnTarget.focus({ preventScroll: true });
    };
  }, [open]);
  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),[tabindex="0"]',
      ),
    ].filter((element) => element.getClientRects().length > 0);
    const target = focusLoopTarget(
      controls.indexOf(document.activeElement as HTMLElement),
      controls.length,
      event.shiftKey,
    );
    if (target !== null) {
      event.preventDefault();
      controls[target].focus();
    }
  }
  const fullHref = `/notes?${new URLSearchParams({ q: query.trim().slice(0, 200) })}`;
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="quick-search-trigger"
        aria-haspopup="dialog"
        aria-label={t(
          "搜索全站课程，快捷键 Command 或 Control K",
          "Search all lessons, Command or Control K",
        )}
        onClick={show}
      >
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <circle
            cx="8.5"
            cy="8.5"
            r="5.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span>{t("搜索", "Search")}</span>
        <kbd>⌘/Ctrl K</kbd>
      </button>
      <dialog
        ref={dialog}
        className="quick-search-dialog"
        aria-labelledby="quick-search-title"
        aria-describedby="quick-search-help"
        onKeyDown={trapFocus}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            close();
        }}
      >
        <div className="quick-search-heading">
          <div>
            <p className="eyebrow">{t("查找一个概念", "FIND AN IDEA")}</p>
            <h2 id="quick-search-title">
              {t("搜索学习资料", "Search your study library")}
            </h2>
          </div>
          <button
            type="button"
            className="quick-search-close"
            aria-label={t("关闭搜索", "Close search")}
            onClick={close}
          >
            ×
          </button>
        </div>
        <form
          className="quick-search-form"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            if (!query.trim()) return;
            (
              results.current?.querySelector<HTMLAnchorElement>("a[href]") ??
              allResults.current
            )?.click();
          }}
        >
          <label htmlFor="quick-search-input" className="sr-only">
            {t("搜索中英文课程", "Search lessons in Chinese and English")}
          </label>
          <input
            ref={input}
            id="quick-search-input"
            type="search"
            value={query}
            maxLength={200}
            autoComplete="off"
            placeholder={t(
              "标题、概念或正文，如“焓”或 entropy…",
              "A title, concept or passage, e.g. entropy…",
            )}
            onChange={(event) => setQuery(event.target.value)}
            aria-controls="quick-search-results"
          />
        </form>
        <p id="quick-search-help" className="quick-search-help">
          {t(
            "搜索中英文课程。Tab 浏览结果，Enter 打开首项，Esc 关闭。",
            "Search lessons in either language. Tab through results, Enter opens the first, Esc closes.",
          )}
        </p>
        <div
          className="quick-search-body"
          aria-busy={search.phase === "loading"}
        >
          <p className="quick-search-status" role="status" aria-live="polite">
            {search.phase === "idle"
              ? t("输入关键词开始搜索。", "Type a keyword to begin.")
              : search.phase === "loading"
                ? t("正在查找相关内容…", "Finding relevant passages…")
                : search.phase === "error"
                  ? t(
                      "搜索暂时不可用，请重试。",
                      "Search is unavailable. Please retry.",
                    )
                  : search.hits.length
                    ? t(
                        `找到 ${search.hits.length} 项，显示前 ${Math.min(8, search.hits.length)} 项。`,
                        `${search.hits.length} results. Showing ${Math.min(8, search.hits.length)}.`,
                      )
                    : t(
                        "没有找到匹配内容。试试更短的关键词。",
                        "No matches. Try a shorter search.",
                      )}
          </p>
          {search.phase === "error" && (
            <button
              type="button"
              className="button-secondary"
              onClick={search.retry}
            >
              {t("重试搜索", "Retry search")}
            </button>
          )}
          {search.partial && (
            <p className="notice text-sm">
              {t(
                "搜索连接不完整，结果可能有所缺漏。",
                "Search is partially connected. Some results may be missing.",
              )}
            </p>
          )}
          <ul
            id="quick-search-results"
            ref={results}
            className="quick-search-results"
            onClick={(event) => {
              if (
                !event.defaultPrevented &&
                event.target instanceof Element &&
                event.target.closest("a[href]")
              )
                close();
            }}
          >
            {search.hits.slice(0, 8).map((hit) => (
              <li key={`${hit.slug}:${hit.locale}`}>
                <SearchResultLink href={hit.href} locale={hit.locale}>
                  <span className="quick-search-result-meta">
                    {hit.subjectTitle}
                    <span>{hit.locale === "zh" ? "中文" : "English"}</span>
                  </span>
                  <h3>{hit.title}</h3>
                  <p>{hit.snippet}</p>
                </SearchResultLink>
              </li>
            ))}
          </ul>
        </div>
        <div className="quick-search-footer">
          {query.trim() ? (
            <a ref={allResults} href={fullHref}>
              {t("查看完整搜索结果 →", "View all search results →")}
            </a>
          ) : (
            <span>
              {t(
                "也可以从学习中心开始浏览。",
                "You can also browse the study library.",
              )}
            </span>
          )}
          <span>Esc</span>
        </div>
      </dialog>
    </>
  );
}
