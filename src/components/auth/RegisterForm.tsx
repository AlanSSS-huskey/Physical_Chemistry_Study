"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";
import {
  accountErrorMessage,
  accountRequest,
  AccountRequestError,
  passwordProblem,
} from "./account-client";
import { AuthShell } from "./AuthShell";
import { AuthFeedback, AuthField, PasswordField } from "./AuthFields";
import { ResendVerification } from "./ResendVerification";
import { useCapabilities } from "./useCapabilities";

export function RegisterForm() {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  const { capabilities, error: capabilityError, retry } = useCapabilities();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [acceptedEmail, setAcceptedEmail] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const password = String(fields.get("password") ?? "");
    const email = String(fields.get("email") ?? "");
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
      await accountRequest("/api/account/register", {
        method: "POST",
        body: {
          name: String(fields.get("name") ?? ""),
          email,
          password,
          locale,
        },
      });
      setAcceptedEmail(email);
    } catch (reason) {
      setError(accountErrorMessage(reason, locale));
    } finally {
      setPending(false);
    }
  }

  if (acceptedEmail !== null)
    return (
      <AuthShell
        title={t("查看你的收件箱", "Check your inbox")}
        description={t(
          "按照邮件中的步骤完成账户设置。",
          "Follow the instructions in your email to finish setting up your account.",
        )}
      >
        <div className="auth-mail-icon" aria-hidden="true">
          ↗
        </div>
        <AuthFeedback
          success
          message={t(
            "请求已受理。如果此邮箱可以继续注册或设置密码，你会收到下一步说明。",
            "Your request was accepted. If this email can continue registration or password setup, you will receive the next steps.",
          )}
        />
        <p className="auth-hint">
          {t(
            "如果邮件要求验证注册，请输入本次注册设置的密码。",
            "If the email asks you to verify a registration, use the password you chose for that registration.",
          )}
        </p>
        <ResendVerification initialEmail={acceptedEmail} initialCooldown={60} />
        <p className="auth-footer-note">
          <Link href="/login">{t("返回登录", "Back to sign in")}</Link>
        </p>
      </AuthShell>
    );

  return (
    <AuthShell
      title={t("从这里，开始积累", "Make room for progress")}
      description={t(
        "创建账户，保存你的学习记录。",
        "Create an account to keep your learning progress together.",
      )}
    >
      <div className="auth-switch">
        <Link href="/login">{t("登录", "Sign in")}</Link>
        <span aria-current="page">{t("创建账户", "Create account")}</span>
      </div>
      {capabilityError ? (
        <div className="auth-stack">
          <AuthFeedback
            message={accountErrorMessage(capabilityError, locale)}
          />
          <button className="button-secondary" type="button" onClick={retry}>
            {t("重试", "Try again")}
          </button>
        </div>
      ) : !capabilities ? (
        <p className="auth-loading" role="status">
          {t("正在检查注册服务…", "Checking registration availability…")}
        </p>
      ) : !capabilities.registration || !capabilities.mail ? (
        <AuthFeedback
          message={t(
            "邮箱注册服务暂时不可用，尚未提交任何信息。请稍后再试。",
            "Email registration is temporarily unavailable. No information has been submitted. Please try again shortly.",
          )}
        />
      ) : (
        <form className="auth-form" onSubmit={submit} aria-busy={pending}>
          <AuthField
            label={t("显示名称", "Display name")}
            name="name"
            autoComplete="nickname"
            required
            maxLength={80}
            disabled={pending}
            placeholder={t("你希望我们如何称呼你", "What should we call you?")}
          />
          <AuthField
            label={t("邮箱", "Email address")}
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            disabled={pending}
            placeholder="you@example.com"
          />
          <PasswordField
            label={t("设置密码", "Create password")}
            name="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={256}
            disabled={pending}
            hint={t(
              "12 至 128 个字符，建议使用容易记住的长短语。",
              "12–128 characters. A memorable passphrase works well.",
            )}
          />
          <PasswordField
            label={t("确认密码", "Confirm password")}
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
              ? t("正在提交…", "Creating your account…")
              : t("创建账户并发送验证邮件", "Create account & verify email")}
            <span aria-hidden="true">→</span>
          </button>
          <p className="auth-hint">
            {t(
              "完成邮箱验证后即可登录。",
              "Verify your email to finish creating your account.",
            )}
          </p>
        </form>
      )}
      <p className="auth-footer-note">
        {t("已通过 Google 登录过？", "Already signed in with Google?")}{" "}
        <Link href="/login">
          {t("使用原有方式登录", "Use your existing sign-in method")}
        </Link>
      </p>
    </AuthShell>
  );
}
