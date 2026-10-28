"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";
import { safeCallbackPath } from "@/lib/auth-config";

export function GoogleSignInButton({
  callbackUrl = "/account",
}: {
  callbackUrl?: string;
}) {
  const { locale } = useLocale();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function login() {
    setPending(true);
    setFailed(false);
    try {
      await signIn("google", { callbackUrl: safeCallbackPath(callbackUrl) });
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        className="button"
        type="button"
        onClick={login}
        disabled={pending}
        aria-busy={pending}
      >
        {pending
          ? textFor(locale, "正在前往 Google…", "Opening Google…")
          : textFor(locale, "使用 Google 登录", "Continue with Google")}
      </button>
      {failed && (
        <p className="notice notice-error text-sm" role="alert">
          {textFor(
            locale,
            "暂时无法登录。请稍后重试。",
            "Sign-in could not be started. Please try again shortly.",
          )}
        </p>
      )}
    </div>
  );
}

export function AuthNav({
  authConfigured = false,
  authStatus,
}: {
  authConfigured?: boolean;
  authStatus?: "ready" | "unconfigured" | "unavailable";
}) {
  const { data, status } = useSession();
  const { locale } = useLocale();
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const callbackUrl = safeCallbackPath(pathname || "/account");

  if (authStatus === "unavailable")
    return (
      <Link
        className="button-ghost text-sm"
        href={`/login?error=unavailable&callbackUrl=${encodeURIComponent(callbackUrl)}`}
      >
        {textFor(locale, "登录暂不可用", "Sign-in unavailable")}
      </Link>
    );
  if (!authConfigured || authStatus === "unconfigured")
    return (
      <Link className="button-ghost text-sm" href="/login">
        {textFor(locale, "登录待配置", "Sign-in setup pending")}
      </Link>
    );
  if (status === "loading")
    return (
      <span className="muted text-sm" role="status">
        {textFor(locale, "正在验证…", "Checking session…")}
      </span>
    );
  if (!data?.user)
    return (
      <Link
        className="button-secondary text-sm"
        href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
      >
        {textFor(locale, "登录", "Sign in")}
      </Link>
    );

  async function logout() {
    setPending(true);
    setFailed(false);
    try {
      await signOut({ callbackUrl: "/" });
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link className="button-ghost text-sm" href="/account">
        {textFor(locale, "学习记录", "My progress")}
      </Link>
      <button
        className="button-secondary text-sm"
        type="button"
        onClick={logout}
        disabled={pending}
        aria-busy={pending}
      >
        {pending
          ? textFor(locale, "正在退出…", "Signing out…")
          : textFor(locale, "退出", "Sign out")}
      </button>
      {failed && (
        <span className="text-sm text-red-700" role="alert">
          {textFor(locale, "退出失败，请重试", "Sign-out failed. Try again.")}
        </span>
      )}
    </div>
  );
}
