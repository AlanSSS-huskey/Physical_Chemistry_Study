"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  return (
    <div className="auth-workspace">
      <aside
        className="auth-editorial"
        aria-label={t("你的学习空间", "Your study space")}
      >
        <Link className="text-link auth-back" href="/learn">
          ← {t("返回学习中心", "Back to the library")}
        </Link>
        <div className="auth-editorial-copy">
          <p className="eyebrow">
            {t("理解，每一步都有积累", "UNDERSTANDING, ONE STEP AT A TIME")}
          </p>
          <h2>
            {t(
              "让每一次学习，\n都有迹可循。",
              "A little progress.\nA deeper understanding.",
            )}
          </h2>
          <p className="muted">
            {t(
              "保存学习进度，在中英文笔记间自由切换。下次回来，从你停下的地方继续。",
              "Keep your progress together as you move between Chinese and English notes. Come back to where you left off.",
            )}
          </p>
          <div className="auth-orbit" aria-hidden="true">
            <span>ψ</span>
            <i />
            <i />
            <i />
          </div>
        </div>
        <p className="auth-editorial-note">
          {t(
            "物理化学 · 为理解而学习",
            "PHYSICAL CHEMISTRY · LEARN TO UNDERSTAND",
          )}
        </p>
      </aside>
      <section className="auth-card">
        <header className="auth-card-header">
          <p className="eyebrow">{t("你的学习空间", "YOUR STUDY SPACE")}</p>
          <h1>{title}</h1>
          <p className="muted">{description}</p>
        </header>
        {children}
      </section>
    </div>
  );
}
