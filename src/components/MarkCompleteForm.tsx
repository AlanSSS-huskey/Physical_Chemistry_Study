import Link from "next/link";
import { getSessionState } from "@/lib/auth";
import { getLocale } from "@/lib/locale-server";
import { contentHref, textFor } from "@/lib/i18n";
import { loadChapterProgress } from "@/lib/progress";
import { ProgressButton } from "@/components/ProgressButton";

export async function MarkCompleteForm({
  contentSlug,
}: {
  contentSlug: string;
}) {
  const [locale, session] = await Promise.all([getLocale(), getSessionState()]);
  if (session.status === "unconfigured") {
    return (
      <div className="notice text-sm">
        {textFor(
          locale,
          "登录服务尚未配置，暂时无法保存学习进度。你仍可继续阅读。",
          "Sign-in has not been configured, so progress cannot be saved yet. You can continue reading.",
        )}
      </div>
    );
  }
  if (session.status === "unavailable") {
    return (
      <div className="notice notice-error text-sm" role="status">
        {textFor(
          locale,
          "登录服务暂时不可用。请稍后刷新页面再保存进度。",
          "Sign-in is temporarily unavailable. Refresh this page shortly to save your progress.",
        )}
      </div>
    );
  }
  if (session.status !== "authenticated") {
    return (
      <div className="notice text-sm">
        {textFor(
          locale,
          "登录后可保存学习进度。",
          "Sign in to save your learning progress.",
        )}{" "}
        <Link
          className="underline"
          href={`/login?callbackUrl=${encodeURIComponent(contentHref(contentSlug))}`}
        >
          {textFor(locale, "登录并保存进度", "Sign in to save progress")}
        </Link>
      </div>
    );
  }
  const progress = await loadChapterProgress(session.user.id, contentSlug);
  if (!progress.available) {
    return (
      <div className="notice notice-error text-sm" role="status">
        {textFor(
          locale,
          "学习进度暂时无法读取。请稍后刷新页面重试。",
          "Your progress could not be loaded. Refresh this page shortly to try again.",
        )}
      </div>
    );
  }
  return (
    <ProgressButton
      key={`${contentSlug}:${progress.completed}`}
      contentSlug={contentSlug}
      initialCompleted={progress.completed}
    />
  );
}
