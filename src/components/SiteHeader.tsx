"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { AuthNav } from "@/components/AuthNav";
import { useLocale } from "@/components/LocaleProvider";
import { LOCALE_COOKIE, textFor, type Locale } from "@/lib/i18n";
import { requestStateNavigation } from "@/lib/navigation-guard";
import { QuickSearch } from "@/components/navigation/QuickSearch";

export function SiteHeader({
  authConfigured,
  authStatus,
}: {
  authConfigured: boolean;
  authStatus: "ready" | "unconfigured" | "unavailable";
}) {
  const { locale } = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const links = [
    { href: "/learn", label: textFor(locale, "学习中心", "Study library") },
    { href: "/notes", label: textFor(locale, "全部笔记", "All notes") },
    { href: "/account", label: textFor(locale, "我的学习", "My learning") },
  ];
  function changeLocale(next: Locale) {
    if (next === locale) return;
    if (!requestStateNavigation(window)) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    startTransition(() => router.refresh());
  }
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link
          href="/"
          className="brand"
          aria-label={textFor(
            locale,
            "物理化学学习站首页",
            "Physical Chemistry Study home",
          )}
        >
          <span className="brand-symbol" aria-hidden="true">
            φ
          </span>
          <span>
            <strong>Physical Chemistry</strong>
            <span className="brand-caption">
              {textFor(
                locale,
                "理解 · 推导 · 练习",
                "UNDERSTAND · DERIVE · PRACTISE",
              )}
            </span>
          </span>
        </Link>
        <nav
          className="desktop-nav"
          aria-label={textFor(locale, "主导航", "Main navigation")}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname.startsWith(link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="header-controls">
          <QuickSearch />
          <div
            className="language-switch"
            role="group"
            aria-label={textFor(locale, "界面语言", "Interface language")}
            aria-busy={pending}
          >
            <button
              type="button"
              lang="zh-CN"
              onClick={() => changeLocale("zh")}
              aria-pressed={locale === "zh"}
              disabled={pending}
            >
              中文
            </button>
            <button
              type="button"
              lang="en"
              onClick={() => changeLocale("en")}
              aria-pressed={locale === "en"}
              disabled={pending}
            >
              EN
            </button>
          </div>
          <div className="header-auth">
            <AuthNav authConfigured={authConfigured} authStatus={authStatus} />
          </div>
        </div>
        <details className="mobile-navigation">
          <summary aria-label={textFor(locale, "打开导航", "Open navigation")}>
            ☰
          </summary>
          <nav aria-label={textFor(locale, "移动端导航", "Mobile navigation")}>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={
                  pathname.startsWith(link.href) ? "page" : undefined
                }
                onClick={(e) =>
                  e.currentTarget.closest("details")?.removeAttribute("open")
                }
              >
                {link.label}
              </Link>
            ))}
            <AuthNav authConfigured={authConfigured} authStatus={authStatus} />
          </nav>
        </details>
      </div>
    </header>
  );
}
