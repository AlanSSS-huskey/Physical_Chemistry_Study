"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";
import { safeCallbackPath } from "@/lib/auth-config";
import { RememberChoice } from "@/components/auth/AuthFields";

export function GoogleSignInButton({
  callbackUrl = "/account",
  remember,
  showRemember = remember === undefined,
  disabled = false,
  onPendingChange,
}: {
  callbackUrl?: string;
  remember?: boolean;
  showRemember?: boolean;
  disabled?: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const { locale } = useLocale();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const effectiveRemember = remember ?? rememberMe;

  async function login() {
    setPending(true);
    onPendingChange?.(true);
    setFailed(false);
    try {
      await signIn("google", {
        callbackUrl: safeCallbackPath(callbackUrl),
        remember: effectiveRemember ? "true" : "false",
      });
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
      onPendingChange?.(false);
    }
  }

  return (
    <div className="space-y-3">
      {showRemember && (
        <RememberChoice
          checked={effectiveRemember}
          onChange={setRememberMe}
          disabled={pending || disabled}
        />
      )}
      <button
        className="button-secondary auth-google-button"
        type="button"
        onClick={login}
        disabled={pending || disabled}
        aria-busy={pending}
      >
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M19.2 10.2c0-.6-.1-1.2-.2-1.8H10v3.4h5.2c-.3 1.1-.9 2-1.9 2.6v2.2h3.1c1.8-1.7 2.8-4 2.8-6.4ZM10 19.5c2.6 0 4.8-.9 6.4-2.3l-3.1-2.4c-.8.5-1.9.9-3.3.9-2.5 0-4.6-1.7-5.4-4H1.4v2.4a9.5 9.5 0 0 0 8.6 5.4ZM4.6 11.7a5.7 5.7 0 0 1 0-3.4V5.9H1.4a9.5 9.5 0 0 0 0 8.2l3.2-2.4ZM10 4.3c1.5 0 2.7.5 3.7 1.5l2.8-2.8A9.2 9.2 0 0 0 10 .5a9.5 9.5 0 0 0-8.6 5.4l3.2 2.4c.8-2.3 2.9-4 5.4-4Z"
          />
        </svg>
        {pending
          ? textFor(locale, "正在前往 Google…", "Opening Google…")
          : textFor(locale, "使用 Google 登录", "Continue with Google")}
      </button>
      <p className="muted text-sm">
        {textFor(
          locale,
          "若 Google 授权页一直加载，请在 Chrome 中打开本站，再发起登录。",
          "If Google's authorization page keeps loading, open this site in Chrome and start sign-in there.",
        )}
      </p>
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
      <Link className="button-ghost text-sm" href="/account/settings">
        {textFor(locale, "账户设置", "Account settings")}
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
