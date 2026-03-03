import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Physical Chemistry Study",
  description: "A Save My Exams-style study site (MVP skeleton)"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-white text-zinc-900">
        <header className="border-b">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold">
              Physical Chemistry Study
            </Link>
            <nav className="flex items-center gap-4 text-sm text-zinc-700">
              <Link href="/learn" className="hover:text-zinc-900">
                Learn
              </Link>
              <Link href="/account" className="hover:text-zinc-900">
                Account
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}

