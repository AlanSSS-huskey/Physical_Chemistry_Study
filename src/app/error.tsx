"use client";

import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { locale } = useLocale();
  return (
    <div className="empty-state panel" role="alert">
      <span className="eyebrow">PLEASE TRY AGAIN</span>
      <h1 className="page-heading">
        {textFor(
          locale,
          "这一页暂时无法打开",
          "This page is temporarily unavailable",
        )}
      </h1>
      <p className="muted">
        {textFor(
          locale,
          "请重新加载页面。已保存的笔记和学习进度不会因此被删除。",
          "Please reload the page. Your saved notes and learning progress are retained.",
        )}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className="button" onClick={reset}>
          {textFor(locale, "重新加载", "Try again")}
        </button>
        <Link className="button-secondary" href="/learn">
          {textFor(locale, "返回学习中心", "Back to the library")}
        </Link>
      </div>
    </div>
  );
}
