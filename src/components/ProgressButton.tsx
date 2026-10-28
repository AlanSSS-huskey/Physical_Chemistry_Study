"use client";

import { useState, useTransition } from "react";
import { setChapterComplete } from "@/app/learn/[subject]/[chapter]/actions";
import { useLocale } from "@/components/LocaleProvider";
import { contentHref, textFor } from "@/lib/i18n";
import type { ProgressUpdateResult } from "@/lib/progress-validation";

export function ProgressButton({
  contentSlug,
  initialCompleted,
}: {
  contentSlug: string;
  initialCompleted: boolean;
}) {
  const { locale } = useLocale();
  const [completed, setCompleted] = useState(initialCompleted);
  const [error, setError] = useState<
    Extract<ProgressUpdateResult, { ok: false }>["error"] | null
  >(null);
  const [pending, startTransition] = useTransition();
  const errors = {
    invalid: textFor(
      locale,
      "章节信息无效。请刷新页面后重试。",
      "This chapter could not be identified. Refresh the page and try again.",
    ),
    unauthenticated: textFor(
      locale,
      "登录已过期。请重新登录后保存进度。",
      "Your session has expired. Sign in again to save your progress.",
    ),
    forbidden: textFor(
      locale,
      "此章节目前无法保存进度。请刷新页面检查访问权限。",
      "Progress cannot be saved for this chapter. Refresh the page to check access.",
    ),
    unavailable: textFor(
      locale,
      "进度暂时无法保存。请稍后重试。",
      "Progress could not be saved. Please try again shortly.",
    ),
  };

  function submit() {
    if (pending) return;
    const target = !completed;
    setError(null);
    startTransition(async () => {
      try {
        const result = await setChapterComplete(contentSlug, target);
        if (result.ok) setCompleted(result.status === "COMPLETED");
        else setError(result.error);
      } catch {
        setError("unavailable");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          className={completed ? "button-secondary" : "button"}
          type="button"
          onClick={submit}
          disabled={pending}
          aria-pressed={completed}
          aria-busy={pending}
        >
          {pending
            ? textFor(locale, "正在保存…", "Saving…")
            : completed
              ? textFor(locale, "已完成 · 撤销", "Completed · undo")
              : textFor(locale, "标记为已完成", "Mark as complete")}
        </button>
        <span className="muted text-sm" role="status" aria-live="polite">
          {completed
            ? textFor(locale, "本章节已完成", "Chapter completed")
            : textFor(
                locale,
                "完成后可在学习记录中查看",
                "Save your progress when you finish",
              )}
        </span>
      </div>
      {error && (
        <div className="notice notice-error text-sm" role="alert">
          {errors[error]}
          {error === "unauthenticated" && (
            <a
              className="ml-2 underline"
              href={`/login?callbackUrl=${encodeURIComponent(contentHref(contentSlug))}`}
            >
              {textFor(locale, "重新登录", "Sign in again")}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
