"use client";

import { useEffect, useRef, useState } from "react";
import { textFor, type Locale } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { studyRequest } from "@/lib/study-client";

export function BookmarkButton({
  slug,
  locale,
  userId,
}: {
  slug: string;
  locale: Locale;
  userId: string;
}) {
  const { locale: uiLocale } = useLocale();
  const [bookmarked, setBookmarked] = useState(false);
  const [phase, setPhase] = useState<"loading" | "ready" | "saving" | "error">(
    "loading",
  );
  const [target, setTarget] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const path = `/api/study/bookmark?${new URLSearchParams({ slug, locale })}`;
  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    void studyRequest<{ bookmarked: boolean }>(path, userId, {
      signal: abort.signal,
    })
      .then((data) => {
        if (!abort.signal.aborted) {
          setBookmarked(data.bookmarked);
          setLoaded(true);
          setPhase("ready");
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) setPhase("error");
      });
    return () => abort.abort();
  }, [path, userId]);
  async function save() {
    if (phase === "loading" || phase === "saving") return;
    if (!loaded) {
      setPhase("loading");
      try {
        const data = await studyRequest<{ bookmarked: boolean }>(path, userId, {
          signal: controller.current?.signal,
        });
        if (!controller.current?.signal.aborted) {
          setBookmarked(data.bookmarked);
          setLoaded(true);
          setPhase("ready");
        }
      } catch {
        if (!controller.current?.signal.aborted) setPhase("error");
      }
      return;
    }
    const next = target ?? !bookmarked;
    setTarget(next);
    setPhase("saving");
    try {
      const saved = await studyRequest<{ bookmarked: boolean }>(
        "/api/study/bookmark",
        userId,
        {
          method: "PUT",
          body: { slug, locale, bookmarked: next },
          signal: controller.current?.signal,
        },
      );
      if (!controller.current?.signal.aborted) {
        setBookmarked(saved.bookmarked);
        setTarget(null);
        setPhase("ready");
      }
    } catch {
      if (!controller.current?.signal.aborted) setPhase("error");
    }
  }
  return (
    <div className="study-bookmark">
      <button
        type="button"
        className="button-secondary"
        disabled={phase === "loading" || phase === "saving"}
        aria-pressed={bookmarked}
        onClick={() => {
          void save();
        }}
      >
        {phase === "loading"
          ? textFor(uiLocale, "读取收藏…", "Loading bookmark…")
          : phase === "saving"
            ? textFor(uiLocale, "正在保存…", "Saving…")
            : phase === "error"
              ? textFor(uiLocale, "重试收藏操作", "Retry bookmark")
              : bookmarked
                ? textFor(uiLocale, "★ 已收藏", "★ Bookmarked")
                : textFor(uiLocale, "☆ 收藏本章", "☆ Bookmark chapter")}
      </button>
      {phase === "error" && (
        <p role="status" className="study-helper">
          {textFor(uiLocale, "收藏尚未同步。", "Bookmark has not synced.")}
        </p>
      )}
    </div>
  );
}
