"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";
import {
  AccountRequestError,
  accountErrorMessage,
  accountRequest,
  passwordProblem,
} from "@/components/auth/account-client";
import { AuthFeedback, PasswordField } from "@/components/auth/AuthFields";
import type { AccountProfile } from "./account-types";

export function SecuritySettings({ profile }: { profile: AccountProfile }) {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  const form = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const password = String(fields.get("password") ?? "");
    const problem = passwordProblem(
      password,
      String(fields.get("confirmation") ?? ""),
    );
    setSaved(false);
    if (problem) {
      setError(accountErrorMessage(new AccountRequestError(problem), locale));
      return;
    }
    setPending(true);
    setError("");
    try {
      await accountRequest("/api/account/change-password", {
        method: "POST",
        body: {
          currentPassword: String(fields.get("currentPassword") ?? ""),
          password,
        },
      });
      form.current?.reset();
      setSaved(true);
    } catch (reason) {
      setError(
        reason instanceof AccountRequestError &&
          ["INVALID_CREDENTIALS", "PASSWORD_MISMATCH"].includes(reason.code)
          ? t(
              "当前密码不正确，请重试。",
              "Your current password is incorrect. Please try again.",
            )
          : accountErrorMessage(reason, locale),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className="account-section"
      id="security"
      aria-labelledby="security-heading"
    >
      <header>
        <p className="eyebrow">02 · {t("安全", "SECURITY")}</p>
        <h2 id="security-heading">
          {t("保护你的账户", "Keep your account secure")}
        </h2>
        <p className="muted">
          {t(
            "管理密码和已关联的登录方式。",
            "Manage your password and connected sign-in methods.",
          )}
        </p>
      </header>
      <div className="account-section-body">
        <div className="account-signin-method">
          <div>
            <strong>{t("邮箱与密码", "Email & password")}</strong>
            <p className="auth-hint">
              {profile.hasPassword
                ? t("已设置密码", "Password is set")
                : t("尚未设置密码", "No password set")}
            </p>
          </div>
          <span className="badge">
            {profile.hasPassword
              ? t("已启用", "Enabled")
              : t("未设置", "Not set")}
          </span>
        </div>
        {profile.googleLinked && (
          <div className="account-signin-method">
            <div>
              <strong>Google</strong>
              <p className="auth-hint">
                {t(
                  "此账户可使用 Google 登录。",
                  "You can sign in to this account with Google.",
                )}
              </p>
            </div>
            <span className="badge">{t("已关联", "Connected")}</span>
          </div>
        )}
        {profile.hasPassword ? (
          <form
            ref={form}
            className="auth-form account-password-form"
            onSubmit={submit}
            aria-busy={pending}
          >
            <h3>{t("修改密码", "Change password")}</h3>
            <PasswordField
              label={t("当前密码", "Current password")}
              name="currentPassword"
              autoComplete="current-password"
              required
              maxLength={256}
              disabled={pending}
            />
            <PasswordField
              label={t("新密码", "New password")}
              name="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={256}
              disabled={pending}
              hint={t(
                "12 至 128 个字符，建议使用独有的长短语。",
                "12–128 characters. Choose a unique, long passphrase.",
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
            {saved && (
              <AuthFeedback
                success
                message={t("密码已更新。", "Your password has been updated.")}
              />
            )}
            <div className="account-form-actions">
              <button className="button" type="submit" disabled={pending}>
                {pending
                  ? t("正在更新…", "Updating…")
                  : t("更新密码", "Update password")}
              </button>
              <Link href="/forgot-password" className="text-link">
                {t("忘记当前密码？", "Forgot your current password?")}
              </Link>
            </div>
          </form>
        ) : (
          <div className="account-password-setup">
            <p>
              {t(
                "通过邮箱确认身份后，你可以设置一个密码。",
                "Confirm ownership of your email to choose a password.",
              )}
            </p>
            <Link className="button-secondary" href="/forgot-password">
              {t("通过邮件设置密码", "Set a password by email")}{" "}
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
