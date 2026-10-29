"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";
import {
  AccountRequestError,
  accountErrorMessage,
  accountRequest,
  passwordProblem,
} from "./account-client";
import { AuthShell } from "./AuthShell";
import { AuthFeedback, PasswordField } from "./AuthFields";
import { useMailToken } from "./useMailToken";

export function ResetPasswordForm() {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  const link = useMailToken("reset");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const password = String(fields.get("password") ?? "");
    const problem = passwordProblem(
      password,
      String(fields.get("confirmation") ?? ""),
    );
    if (problem) {
      setError(accountErrorMessage(new AccountRequestError(problem), locale));
      return;
    }
    setPending(true);
    setError("");
    try {
      await accountRequest("/api/account/reset-password", {
        method: "POST",
        body: { token: link.token, password },
      });
      setSuccess(true);
    } catch (reason) {
      setError(accountErrorMessage(reason, locale));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title={
        success
          ? t("新密码已设置", "Your new password is set")
          : t("设置一个新的密码", "Choose a fresh password")
      }
      description={
        success
          ? t(
              "你可以使用新密码重新登录。",
              "You can now sign in with your new password.",
            )
          : t(
              "用一个容易记住的长密码，保护你的学习空间。",
              "Keep your study space secure with a memorable, long password.",
            )
      }
    >
      {success ? (
        <div className="auth-stack">
          <AuthFeedback
            success
            message={t(
              "密码已更新，所有旧登录会话已退出。请使用新密码重新登录。",
              "Your password has been updated and all existing sessions have been signed out. Sign in again with your new password.",
            )}
          />
          <Link className="button auth-submit" href="/login">
            {t("前往登录", "Continue to sign in")}{" "}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      ) : link.state === "checking" ? (
        <p className="auth-loading" role="status">
          {t("正在检查重置链接…", "Checking your reset link…")}
        </p>
      ) : link.state === "valid" ? (
        <>
          <p className="auth-destination">
            {t("账户邮箱", "Account email")} <strong>{link.emailMasked}</strong>
          </p>
          <form className="auth-form" onSubmit={submit} aria-busy={pending}>
            <PasswordField
              label={t("新密码", "New password")}
              name="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={256}
              disabled={pending}
              hint={t(
                "12 至 128 个字符，可使用空格、中文或短语。",
                "12–128 characters. Spaces, phrases and non-Latin characters are welcome.",
              )}
            />
            <PasswordField
              label={t("确认新密码", "Confirm new password")}
              name="confirmation"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={256}
              disabled={pending}
            />
            <AuthFeedback message={error} />
            <button
              className="button auth-submit"
              type="submit"
              disabled={pending}
            >
              {pending
                ? t("正在更新…", "Updating password…")
                : t("保存新密码", "Save new password")}
              <span aria-hidden="true">→</span>
            </button>
            <p className="auth-hint">
              {t(
                "更新密码后，所有设备上的旧登录会话都会退出。",
                "Updating your password signs out existing sessions on all devices.",
              )}
            </p>
          </form>
        </>
      ) : (
        <div className="auth-stack">
          {!!link.error && (
            <AuthFeedback message={accountErrorMessage(link.error, locale)} />
          )}
          {link.state === "missing" && (
            <p className="notice" role="status">
              {t(
                "请从密码设置邮件中打开完整链接，或申请新的链接。",
                "Open the complete link from your password email, or request a new one.",
              )}
            </p>
          )}
          {link.state === "unavailable" ? (
            <button
              type="button"
              className="button-secondary auth-submit"
              onClick={link.retry}
            >
              {t("重新检查链接", "Check the link again")}
            </button>
          ) : (
            <Link className="button auth-submit" href="/forgot-password">
              {t("申请新的重置邮件", "Request a new reset email")}
            </Link>
          )}
        </div>
      )}
      {!success && (
        <p className="auth-footer-note">
          <Link href="/login">← {t("返回登录", "Back to sign in")}</Link>
        </p>
      )}
    </AuthShell>
  );
}
