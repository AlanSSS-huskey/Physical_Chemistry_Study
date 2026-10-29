"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { GoogleSignInButton } from "@/components/AuthNav";
import { useLocale } from "@/components/LocaleProvider";
import { safeCallbackPath } from "@/lib/auth-config";
import { textFor } from "@/lib/i18n";
import { accountErrorMessage, accountRequest } from "./account-client";
import { AuthShell } from "./AuthShell";
import {
  AuthFeedback,
  AuthField,
  PasswordField,
  RememberChoice,
} from "./AuthFields";
import { useCapabilities } from "./useCapabilities";

export function LoginForm({
  callbackUrl,
  initialError,
}: {
  callbackUrl: string;
  initialError?: string;
}) {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  const { capabilities, error: capabilityError, retry } = useCapabilities();
  const [remember, setRemember] = useState(true);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [error, setError] = useState("");
  const busy = pending || googlePending;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const result = await accountRequest<{ ok: true; redirectTo: string }>(
        "/api/account/login",
        {
          method: "POST",
          body: {
            email: String(fields.get("email") ?? ""),
            password: String(fields.get("password") ?? ""),
            remember,
            callbackUrl,
          },
        },
      );
      window.location.assign(safeCallbackPath(result.redirectTo));
    } catch (reason) {
      setError(accountErrorMessage(reason, locale));
      setPending(false);
    }
  }

  return (
    <AuthShell
      title={t("欢迎回来", "Welcome back")}
      description={t(
        "登录你的账户，继续上次的学习。",
        "Sign in to your account and pick up where you left off.",
      )}
    >
      <div className="auth-switch">
        <span aria-current="page">{t("登录", "Sign in")}</span>
        <Link href="/register">{t("创建账户", "Create account")}</Link>
      </div>
      {initialError && !error && (
        <AuthFeedback
          message={
            initialError === "unavailable"
              ? t(
                  "登录服务暂时不可用，请稍后重试。",
                  "Sign-in is temporarily unavailable. Please try again shortly.",
                )
              : t(
                  "Google 登录未完成。请重试，或使用已关联账户的登录方式。",
                  "Google sign-in was not completed. Try again, or use the sign-in method linked to your account.",
                )
          }
        />
      )}
      {capabilityError ? (
        <div className="auth-stack">
          <AuthFeedback
            message={accountErrorMessage(capabilityError, locale)}
          />
          <button className="button-secondary" type="button" onClick={retry}>
            {t("重新加载登录方式", "Reload sign-in options")}
          </button>
        </div>
      ) : !capabilities ? (
        <p className="auth-loading" role="status">
          {t("正在加载登录方式…", "Loading sign-in options…")}
        </p>
      ) : (
        <>
          {capabilities.googlePreviewUnavailable && (
            <p className="notice" role="status">
              {t(
                "当前预览地址尚未配置 Google 授权。可使用已有邮箱密码测试；Google 登录请前往",
                "Google authorization is not configured for this preview. Test with an existing email and password, or use Google on the ",
              )}{" "}
              <a
                className="text-link"
                href="https://physical-chemistry-study.vercel.app/login"
              >
                {t("正式网站", "live website")}
              </a>
              。
            </p>
          )}
          {!capabilities.passwordLogin && !capabilities.google && (
            <AuthFeedback
              message={t(
                "登录服务尚未就绪，请稍后再来。你仍可浏览公开学习内容。",
                "Sign-in is not ready yet. Please come back shortly. You can still browse public learning content.",
              )}
            />
          )}
          {capabilities.passwordLogin && (
            <form className="auth-form" onSubmit={submit} aria-busy={pending}>
              <AuthField
                label={t("邮箱", "Email address")}
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="you@example.com"
                disabled={busy}
              />
              <PasswordField
                label={t("密码", "Password")}
                name="password"
                autoComplete="current-password"
                required
                maxLength={256}
                disabled={busy}
              />
              <div className="auth-inline-link">
                <Link href="/forgot-password">
                  {t("忘记密码？", "Forgot password?")}
                </Link>
              </div>
              <RememberChoice
                checked={remember}
                onChange={setRemember}
                disabled={busy}
              />
              <AuthFeedback message={error} />
              <button
                className="button auth-submit"
                type="submit"
                disabled={busy}
              >
                {pending ? t("正在登录…", "Signing in…") : t("登录", "Sign in")}
                <span aria-hidden="true">→</span>
              </button>
            </form>
          )}
          {!capabilities.passwordLogin && capabilities.google && (
            <RememberChoice
              checked={remember}
              onChange={setRemember}
              disabled={busy}
            />
          )}
          {capabilities.google && (
            <>
              <div className="auth-divider">
                <span>{t("或使用", "or continue with")}</span>
              </div>
              <GoogleSignInButton
                callbackUrl={callbackUrl}
                remember={remember}
                showRemember={false}
                disabled={pending}
                onPendingChange={setGooglePending}
              />
            </>
          )}
        </>
      )}
      <p className="auth-footer-note">
        {t("还没验证邮箱？", "Still need to verify your email?")}{" "}
        <Link href="/verify-email">
          {t("重新发送验证邮件", "Resend verification email")}
        </Link>
      </p>
      <Link className="auth-mobile-back" href="/learn">
        ← {t("先浏览学习内容", "Browse the library first")}
      </Link>
    </AuthShell>
  );
}
