"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";
import { accountErrorMessage, accountRequest } from "./account-client";
import { AuthShell } from "./AuthShell";
import { AuthFeedback, AuthField } from "./AuthFields";

export function ForgotPasswordForm() {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setPending(true);
    setAccepted(false);
    setError("");
    try {
      await accountRequest("/api/account/forgot-password", {
        method: "POST",
        body: { email, locale },
      });
      setAccepted(true);
    } catch (reason) {
      setError(accountErrorMessage(reason, locale));
    } finally {
      setPending(false);
    }
  }
  return (
    <AuthShell
      title={t("重新找回学习的节奏", "Let’s get you back in")}
      description={t(
        "输入账户邮箱，我们会发送设置或重置密码的说明。",
        "Enter your account email to request instructions for setting or resetting your password.",
      )}
    >
      <form className="auth-form" onSubmit={submit} aria-busy={pending}>
        <AuthField
          label={t("账户邮箱", "Account email")}
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          disabled={pending}
          placeholder="you@example.com"
        />
        <AuthFeedback message={error} />
        {accepted && (
          <AuthFeedback
            success
            message={t(
              "请求已受理。如果此邮箱对应账户，请查看收件箱和垃圾邮件文件夹中的密码设置说明。",
              "Your request was accepted. If an account uses this email, check your inbox and spam folder for password instructions.",
            )}
          />
        )}
        <button className="button auth-submit" type="submit" disabled={pending}>
          {pending
            ? t("正在发送…", "Sending…")
            : accepted
              ? t("再次请求邮件", "Request another email")
              : t("发送密码重置邮件", "Send password reset email")}
          <span aria-hidden="true">→</span>
        </button>
        <p className="auth-hint">
          {t(
            "重置链接有效期为 30 分钟。为保护账户信息，此页面不会透露邮箱是否已注册。",
            "Reset links expire after 30 minutes. To protect account privacy, this page does not disclose whether an email is registered.",
          )}
        </p>
      </form>
      <p className="auth-footer-note">
        <Link href="/login">← {t("返回登录", "Back to sign in")}</Link>
      </p>
    </AuthShell>
  );
}
