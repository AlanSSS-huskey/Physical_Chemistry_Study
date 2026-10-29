"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { contentHref, textFor, type Locale } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { ReadingPreferences } from "./ReadingPreferences";
import { ReadingPosition } from "./ReadingPosition";
import { BookmarkButton } from "./BookmarkButton";
import { PrivateNote } from "./PrivateNote";

export function StudyWorkspace({
  slug,
  locale,
  authenticatedUserId,
  canRead,
}: {
  slug: string;
  locale: Locale;
  authenticatedUserId?: string;
  canRead: boolean;
}) {
  const { locale: uiLocale } = useLocale();
  const { data: session, status } = useSession();
  if (authenticatedUserId && status === "loading")
    return (
      <div className="study-workspace" role="status">
        {textFor(
          uiLocale,
          "正在读取你的学习空间…",
          "Loading your study workspace…",
        )}
      </div>
    );
  if (authenticatedUserId && session?.user?.id !== authenticatedUserId)
    return (
      <div className="study-workspace">
        <p>
          {textFor(
            uiLocale,
            "登录账户已变化，请重新打开本章。",
            "Your signed-in account changed. Reopen this chapter to continue.",
          )}
        </p>
        <a className="study-text-button" href={contentHref(slug)}>
          {textFor(uiLocale, "重新打开本章", "Reopen chapter")}
        </a>
      </div>
    );
  return (
    <section
      className="study-workspace"
      aria-label={textFor(uiLocale, "我的阅读空间", "My reading workspace")}
    >
      <div className="study-toolbar">
        <ReadingPreferences
          key={authenticatedUserId || "anonymous"}
          locale={uiLocale}
          userId={authenticatedUserId}
        />
        {authenticatedUserId && canRead && (
          <BookmarkButton
            slug={slug}
            locale={locale}
            userId={authenticatedUserId}
          />
        )}
        <Link className="study-text-button" href="/account/library">
          {textFor(uiLocale, "我的收藏与笔记 →", "My bookmarks & notes →")}
        </Link>
      </div>
      {authenticatedUserId && canRead && (
        <ReadingPosition
          slug={slug}
          locale={locale}
          userId={authenticatedUserId}
        />
      )}
      {authenticatedUserId && (
        <PrivateNote
          slug={slug}
          locale={locale}
          userId={authenticatedUserId}
          canRead={canRead}
        />
      )}
      {(!authenticatedUserId || !canRead) && (
        <p className="study-helper">
          {textFor(
            uiLocale,
            authenticatedUserId
              ? "获得本章阅读权限后，可保存阅读位置、收藏和新笔记；已有的私人文字仍保留。"
              : "登录后可跨设备续读、收藏章节并保存私人笔记。",
            authenticatedUserId
              ? "Reading access enables positions, bookmarks and new notes. Your existing private writing is retained."
              : "Sign in to resume across devices, bookmark chapters and keep private notes.",
          )}
          {!authenticatedUserId && (
            <>
              {" "}
              <Link
                className="study-text-button"
                href={`/login?callbackUrl=${encodeURIComponent(contentHref(slug))}`}
              >
                {textFor(uiLocale, "登录", "Sign in")}
              </Link>
            </>
          )}
        </p>
      )}
    </section>
  );
}
