"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { safeCallbackPath } from "@/lib/auth-config";
import { textFor } from "@/lib/i18n";
import {
  AccountRequestError,
  accountErrorMessage,
  accountRequest,
} from "./account-client";
import { AuthShell } from "./AuthShell";
import { AuthFeedback, PasswordField, RememberChoice } from "./AuthFields";
import { ResendVerification } from "./ResendVerification";
import { useMailToken } from "./useMailToken";

export function VerifyEmailForm({
  callbackUrl = "/account",
}: {
  callbackUrl?: string;
}) {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  const link = useMailToken("verify");
  const [pending, setPending] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false);
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(
      new FormData(event.currentTarget).get("password") ?? "",
    );
    setPending(true);
    setError("");
    try {
      const result = await accountRequest<{ ok: true; redirectTo: string }>(
        "/api/account/verify",
        {
          method: "POST",
          body: { token: link.token, password, remember, callbackUrl },
        },
      );
      setSuccess(true);
      window.location.assign(safeCallbackPath(result.redirectTo));
    } catch (reason) {
      setError(accountErrorMessage(reason, locale));
      setNeedsPasswordReset(
        reason instanceof AccountRequestError &&
          reason.code === "USE_PASSWORD_RESET",
      );
      setPending(false);
    }
  }

  return (
    <AuthShell
      title={
        success
          ? t("邮箱验证成功", "Email verified")
          : link.state === "missing"
            ? t("验证你的邮箱", "Verify your email")
            : t("最后一步，确认是你", "One last step: make it yours")
      }
      description={t(
        "验证邮箱后即可保存并同步你的学习记录。",
        "Verify your email to save and sync your learning progress.",
      )}
    >
      {link.state === "checking" ? (
        <p className="auth-loading" role="status">
          {t("正在检查邮件链接…", "Checking your email link…")}
        </p>
      ) : success ? (
        <AuthFeedback
          success
          message={t(
            "邮箱已验证，正在前往你的学习空间…",
            "Your email is verified. Opening your study space…",
          )}
        />
      ) : link.state === "valid" ? (
        <>
          <p className="auth-destination">
            {t("即将验证", "Verifying")} <strong>{link.emailMasked}</strong>
          </p>
          <form className="auth-form" onSubmit={submit} aria-busy={pending}>
            <PasswordField
              label={t("注册时设置的密码", "Password chosen at registration")}
              name="password"
              autoComplete="current-password"
              required
              minLength={12}
              maxLength={256}
              disabled={pending}
              hint={t(
                "请输入创建账户时设置的密码，以确认此注册由你发起。",
                "Enter the password you chose when creating the account to confirm you started this registration.",
              )}
            />
            <RememberChoice
              checked={remember}
              onChange={setRemember}
              disabled={pending}
            />
            <AuthFeedback message={error} />
            <button
              className="button auth-submit"
              type="submit"
              disabled={pending}
            >
              {pending
                ? t("正在验证…", "Verifying…")
                : t("验证邮箱并登录", "Verify email & sign in")}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <p className="auth-footer-note">
            <Link href={needsPasswordReset ? "/forgot-password" : "/register"}>
              {needsPasswordReset
                ? t(
                    "通过邮件设置账户密码",
                    "Set your account password by email",
                  )
                : t(
                    "忘记注册密码？重新开始注册",
                    "Forgot your registration password? Start again",
                  )}
            </Link>
          </p>
        </>
      ) : (
        <>
          {!!link.error && (
            <AuthFeedback message={accountErrorMessage(link.error, locale)} />
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
            <>
              <p className="auth-hint">
                {t(
                  "从最新的验证邮件中打开链接，或在下方重新申请。验证链接有效期为 24 小时。",
                  "Open the link in your latest verification email, or request another below. Verification links expire after 24 hours.",
                )}
              </p>
              <ResendVerification />
            </>
          )}
        </>
      )}
      <p className="auth-footer-note">
        <Link href="/login">← {t("返回登录", "Back to sign in")}</Link>
      </p>
    </AuthShell>
  );
}
