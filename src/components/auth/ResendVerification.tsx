"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";
import {
  AccountRequestError,
  accountErrorMessage,
  accountRequest,
} from "./account-client";
import { AuthFeedback, AuthField } from "./AuthFields";

export function ResendVerification({
  initialEmail = "",
  initialCooldown = 0,
}: {
  initialEmail?: string;
  initialCooldown?: number;
}) {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  const [email, setEmail] = useState(initialEmail);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [cooldown, setCooldown] = useState(initialCooldown);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setAccepted(false);
    try {
      await accountRequest("/api/account/resend-verification", {
        method: "POST",
        body: { email, locale },
      });
      setAccepted(true);
      setCooldown(60);
    } catch (reason) {
      setError(accountErrorMessage(reason, locale));
      if (
        reason instanceof AccountRequestError &&
        reason.code === "RATE_LIMITED"
      )
        setCooldown(Math.max(1, reason.retryAfter ?? 60));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="auth-form auth-resend"
      onSubmit={submit}
      aria-busy={pending}
    >
      <AuthField
        label={t("注册时使用的邮箱", "Email used to register")}
        name="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
        maxLength={254}
        disabled={pending}
      />
      <AuthFeedback message={error} />
      {accepted && (
        <AuthFeedback
          success
          message={t(
            "请求已受理。如果此邮箱需要验证，请查看收件箱中的下一步说明。",
            "Your request was accepted. If this email needs verification, check your inbox for the next steps.",
          )}
        />
      )}
      <button
        className="button-secondary auth-submit"
        type="submit"
        disabled={pending || cooldown > 0}
      >
        {pending
          ? t("正在发送…", "Sending…")
          : cooldown > 0
            ? t(`${cooldown} 秒后可重新发送`, `Resend in ${cooldown}s`)
            : t("发送验证邮件", "Send verification email")}
      </button>
      <p className="auth-hint">
        {t(
          "也请检查垃圾邮件文件夹。新邮件中的链接将替代之前的链接。",
          "Check your spam folder too. The link in your new email replaces previous links.",
        )}
      </p>
    </form>
  );
}
