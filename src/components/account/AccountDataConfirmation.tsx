"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getSession } from "next-auth/react";
import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";
import {
  accountErrorMessage,
  accountRequest,
  tokenFromFragment,
} from "@/components/auth/account-client";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthField, AuthFeedback } from "@/components/auth/AuthFields";

type Details = {
  emailMasked: string;
  previousEmailMasked?: string;
  side?: "old" | "new";
  expiresAt: string;
};
type Result<T> = { ok: true; data: T };
export function AccountDataConfirmation({
  kind,
}: {
  kind: "email" | "delete";
}) {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  const [token, setToken] = useState<string | null>(null);
  const [parsed, setParsed] = useState(false);
  const fragmentRead = useRef(false);
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [result, setResult] = useState<{
    completed: boolean;
    cleanupPending?: boolean;
  } | null>(null);
  const base =
    kind === "email" ? "/api/account/email-change" : "/api/account/delete";
  useEffect(() => {
    if (fragmentRead.current) return;
    fragmentRead.current = true;
    const value = tokenFromFragment(window.location.hash);
    setToken(value);
    setParsed(true);
    if (value)
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
  }, []);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setError(null);
    setDetails(null);
    accountRequest<Result<Details>>(`${base}/status`, {
      method: "POST",
      body: { token },
      signal: controller.signal,
    })
      .then((response) => setDetails(response.data))
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason);
      });
    return () => controller.abort();
  }, [token, attempt, base]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !token ||
      !understood ||
      (kind === "delete" && confirmation !== "DELETE")
    )
      return;
    setPending(true);
    setError(null);
    try {
      const response = await accountRequest<
        Result<{
          completed?: boolean;
          deleted?: boolean;
          cleanupPending?: boolean;
        }>
      >(`${base}/confirm`, {
        method: "POST",
        body:
          kind === "email"
            ? { token, confirm: true }
            : { token, confirmation: "DELETE" },
      });
      const completed =
        kind === "email"
          ? Boolean(response.data.completed)
          : Boolean(response.data.deleted);
      setResult({ completed, cleanupPending: response.data.cleanupPending });
      if (completed) void getSession().catch(() => {});
    } catch (reason) {
      setError(reason);
    } finally {
      setPending(false);
    }
  }
  return (
    <AuthShell
      title={
        kind === "email"
          ? t("确认账户邮箱变更", "Confirm your account email change")
          : t("确认注销账户", "Confirm account deletion")
      }
      description={t(
        "打开邮件链接不会执行操作。请核对下方说明，再明确确认。",
        "Opening the email link does not perform the action. Review the details below and explicitly confirm.",
      )}
    >
      {result ? (
        <div className="auth-stack">
          <AuthFeedback
            success
            message={
              kind === "delete"
                ? t(
                    "账户已注销，私人学习记录和登录会话已删除。",
                    "Your account has been deleted, including private study records and sign-in sessions.",
                  )
                : result.completed
                  ? t(
                      "两个邮箱均已确认，账户邮箱已更换，所有旧登录会话已退出。",
                      "Both mailboxes are confirmed. Your account email has changed and all old sessions are signed out.",
                    )
                  : t(
                      "这个邮箱已确认。请继续打开另一个邮箱中的最新确认邮件；当前账户邮箱尚未更换。",
                      "This mailbox is confirmed. Open the latest confirmation email in the other inbox to finish. Your account email has not changed yet.",
                    )
            }
          />
          {result.cleanupPending && (
            <p className="notice" role="status">
              {t(
                "头像文件已加入清理队列，管理员可以重试未完成的清理。",
                "Avatar files are queued for cleanup. An administrator can retry any remaining files.",
              )}
            </p>
          )}
          <Link
            className="button auth-submit"
            href={
              kind === "delete"
                ? "/"
                : result.completed
                  ? "/login"
                  : "/account/settings"
            }
          >
            {kind === "delete"
              ? t("返回首页", "Return home")
              : result.completed
                ? t("使用新邮箱重新登录", "Sign in with your new email")
                : t("返回账户设置", "Back to account settings")}
          </Link>
        </div>
      ) : !parsed || (token && !details && !error) ? (
        <p className="auth-loading" role="status">
          {t("正在检查确认链接…", "Checking the confirmation link…")}
        </p>
      ) : !token ? (
        <div className="auth-stack">
          <p className="notice" role="status">
            {t(
              "请从最新确认邮件中打开完整链接，或回到账户设置重新申请。",
              "Open the complete link from the latest confirmation email, or request a new one from account settings.",
            )}
          </p>
          <Link
            className="button-secondary auth-submit"
            href="/account/settings"
          >
            {t("账户设置", "Account settings")}
          </Link>
        </div>
      ) : (
        <div className="auth-stack">
          {details && (
            <form className="auth-form" onSubmit={submit} aria-busy={pending}>
              <p className="auth-destination">
                {kind === "email" ? (
                  <>
                    {details.previousEmailMasked}{" "}
                    <span aria-hidden="true">→</span>{" "}
                    <strong>{details.emailMasked}</strong>
                  </>
                ) : (
                  <>
                    {t("账户邮箱", "Account email")}{" "}
                    <strong>{details.emailMasked}</strong>
                  </>
                )}
              </p>
              <p>
                {kind === "email"
                  ? details.side === "old"
                    ? t(
                        "你正在授权离开旧邮箱。新邮箱也必须独立确认，才能完成变更。",
                        "You are approving the change from your old mailbox. The new mailbox must also confirm separately.",
                      )
                    : t(
                        "你正在确认新邮箱的归属。旧邮箱也必须独立授权，才能完成变更。",
                        "You are confirming ownership of the new mailbox. The old mailbox must also approve separately.",
                      )
                  : t(
                      "确认后会永久删除此账户的私人笔记、收藏、阅读记录和登录方式。公开文章配图会保留。此操作无法撤销。",
                      "Confirming permanently removes this account’s private notes, bookmarks, reading records and sign-in methods. Public article illustrations remain available. This cannot be undone.",
                    )}
              </p>
              <label className="flex items-start gap-3 text-sm">
                <input
                  className="mt-1"
                  type="checkbox"
                  required
                  checked={understood}
                  onChange={(event) => setUnderstood(event.target.checked)}
                  disabled={pending}
                />
                <span>
                  {kind === "email"
                    ? t(
                        "我了解本次邮箱变更，确认这是我的操作。",
                        "I understand this email change and confirm that I requested it.",
                      )
                    : t(
                        "我已保存需要的备份，并同意永久注销此账户。",
                        "I have saved any backup I need and agree to permanently delete this account.",
                      )}
                </span>
              </label>
              {kind === "delete" && (
                <AuthField
                  label={t("输入 DELETE 确认", "Type DELETE to confirm")}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  required
                  disabled={pending}
                />
              )}
              <button
                className={
                  kind === "delete"
                    ? "button-secondary auth-submit text-red-700"
                    : "button auth-submit"
                }
                type="submit"
                disabled={
                  pending ||
                  !understood ||
                  (kind === "delete" && confirmation !== "DELETE")
                }
              >
                {pending
                  ? t("正在确认…", "Confirming…")
                  : kind === "email"
                    ? t("确认这个邮箱", "Confirm this mailbox")
                    : t("永久注销此账户", "Permanently delete this account")}
              </button>
              <p className="auth-hint">
                {t(
                  "确认链接在申请后 30 分钟内有效，只能使用一次。",
                  "Confirmation links are valid for 30 minutes after the request and can be used once.",
                )}
              </p>
            </form>
          )}
          {!!error && (
            <>
              <AuthFeedback message={accountErrorMessage(error, locale)} />
              <button
                className="button-secondary auth-submit"
                type="button"
                disabled={pending}
                onClick={() => setAttempt((value) => value + 1)}
              >
                {t("重新检查链接", "Check the link again")}
              </button>
            </>
          )}
          <Link className="text-link" href="/account/settings">
            ← {t("返回账户设置", "Back to account settings")}
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
