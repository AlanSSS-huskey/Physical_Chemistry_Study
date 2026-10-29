import Link from "next/link";
import { getSessionState } from "@/lib/auth";
import { getLocale } from "@/lib/locale-server";
import { textFor } from "@/lib/i18n";
import { StudyLibrary } from "@/components/study/StudyLibrary";

export default async function PersonalLibraryPage() {
  const [session, locale] = await Promise.all([getSessionState(), getLocale()]);
  return (
    <div className="study-library-page">
      <header className="space-y-3">
        <Link href="/account" className="eyebrow">
          ← {textFor(locale, "我的学习", "MY LEARNING")}
        </Link>
        <h1 className="page-heading">
          {textFor(locale, "自己的学习空间", "Your study workspace")}
        </h1>
        <p className="muted">
          {textFor(
            locale,
            "收藏值得重读的章节，保留自己的理解，继续上次的阅读。",
            "Keep chapters worth revisiting, your own explanations, and a place to pick up again.",
          )}
        </p>
      </header>
      {session.status === "authenticated" ? (
        <StudyLibrary
          key={session.user.id}
          userId={session.user.id}
          locale={locale}
        />
      ) : (
        <div className="panel space-y-4 p-6">
          <p role="status">
            {textFor(
              locale,
              session.status === "anonymous"
                ? "登录后即可查看你的私人收藏、笔记和阅读记录。"
                : "账户服务暂时无法读取你的学习空间，请稍后重试。",
              session.status === "anonymous"
                ? "Sign in to see your private bookmarks, notes and reading history."
                : "Your study workspace could not be loaded. Please try again shortly.",
            )}
          </p>
          <Link
            className="button-secondary"
            href={
              session.status === "anonymous"
                ? "/login?callbackUrl=%2Faccount%2Flibrary"
                : "/account/library"
            }
          >
            {textFor(
              locale,
              session.status === "anonymous" ? "登录" : "重新加载",
              session.status === "anonymous" ? "Sign in" : "Reload",
            )}
          </Link>
        </div>
      )}
    </div>
  );
}
