"use client";

import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";

export default function LoadingPage() {
  const { locale } = useLocale();
  return (
    <div className="loading-state" role="status" aria-busy="true">
      <p className="eyebrow">
        {textFor(locale, "正在加载学习内容…", "LOADING YOUR STUDY SPACE…")}
      </p>
      <div className="skeleton h-10 w-2/3" />
      <div className="skeleton h-5 w-1/2" />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="skeleton h-48" />
        <div className="skeleton h-48" />
      </div>
    </div>
  );
}
