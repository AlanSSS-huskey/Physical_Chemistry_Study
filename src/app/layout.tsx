import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "@/components/study/study.css";
import "@/components/navigation/navigation.css";
import "katex/dist/katex.min.css";
import { Providers } from "@/app/providers";
import { SiteHeader } from "@/components/SiteHeader";
import { LocaleProvider } from "@/components/LocaleProvider";
import { getAuthAvailability, getSessionState } from "@/lib/auth";
import { getLocale } from "@/lib/locale-server";
import { textFor } from "@/lib/i18n";

export const metadata: Metadata = {
  title: {
    default: "Physical Chemistry Study · 物理化学",
    template: "%s · Physical Chemistry Study",
  },
  description:
    "Bilingual physical chemistry lessons, worked examples and study notes. 中英文物理化学课程、例题与学习笔记。",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const authConfigured = getAuthAvailability().status === "ready";
  const session = await getSessionState();
  const authStatus =
    session.status === "unavailable"
      ? "unavailable"
      : getAuthAvailability().status;
  return (
    <html lang={locale === "zh" ? "zh-CN" : "en"}>
      <body>
        <LocaleProvider locale={locale}>
          <Providers>
            <a href="#main-content" className="skip-link">
              {textFor(locale, "跳至正文", "Skip to content")}
            </a>
            <SiteHeader
              authConfigured={authConfigured}
              authStatus={authStatus}
            />
            <main id="main-content" className="site-main">
              {children}
            </main>
            <footer className="site-footer">
              <div>
                <strong>Physical Chemistry Study</strong>
                <p>
                  {textFor(
                    locale,
                    "从一个概念开始，把理解连成体系。",
                    "One concept at a time. A connected understanding.",
                  )}
                </p>
              </div>
              <div className="footer-links">
                <span>中文 / English</span>
                <Link href="/admin">
                  {textFor(locale, "内容管理", "Manage content")}
                </Link>
              </div>
            </footer>
          </Providers>
        </LocaleProvider>
      </body>
    </html>
  );
}
