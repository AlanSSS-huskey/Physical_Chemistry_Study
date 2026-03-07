import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import Link from "next/link";
import { Providers } from "@/app/providers";
import { AuthNav } from "@/components/AuthNav";
import { getGoogleOAuthConfig } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Physical Chemistry Study",
  description: "Physical Chemistry 学习站点（MVP）"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authConfigured = getGoogleOAuthConfig().configured;
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-white text-zinc-900">
        <Providers>
          <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
              <Link href="/" className="text-sm font-black tracking-[0.12em] text-slate-800 uppercase">
                Physical Chem Lab
              </Link>
              <nav className="flex flex-1 items-center justify-end gap-2 text-sm text-slate-700">
                <Link href="/learn" className="rounded-md px-3 py-1.5 hover:bg-slate-100 hover:text-slate-900">
                  学习
                </Link>
                <Link href="/notes" className="rounded-md px-3 py-1.5 hover:bg-slate-100 hover:text-slate-900">
                  Notes
                </Link>
                <Link href="/account" className="rounded-md px-3 py-1.5 hover:bg-slate-100 hover:text-slate-900">
                  账户
                </Link>
                <Link href="/admin" className="rounded-md px-3 py-1.5 hover:bg-slate-100 hover:text-slate-900">
                  Admin
                </Link>
                <AuthNav authConfigured={authConfigured} />
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
