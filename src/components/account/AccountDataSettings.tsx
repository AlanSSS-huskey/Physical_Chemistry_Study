"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getSession } from "next-auth/react";
import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";
import {
  AccountRequestError,
  accountErrorMessage,
  accountRequest,
} from "@/components/auth/account-client";
import {
  AuthField,
  AuthFeedback,
  PasswordField,
} from "@/components/auth/AuthFields";
import type { AccountProfile } from "./account-types";

type Summary = {
  mail: boolean;
  hasPassword: boolean;
  isAdmin: boolean;
  storageCleanupPending?: number;
};
type Result<T> = { ok: true; data: T };
export function AccountDataSettings({
  profile,
  onDeleted,
}: {
  profile: AccountProfile;
  onDeleted: (cleanupPending: boolean) => void;
}) {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [pending, setPending] = useState<
    "export" | "email" | "delete" | "cleanup" | null
  >(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const emailForm = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoadError("");
    setSummary(null);
    accountRequest<Result<Summary>>("/api/account/data", {
      signal: controller.signal,
      accountUserId: profile.id,
    })
      .then((result) => setSummary(result.data))
      .catch((reason) => {
        if (!controller.signal.aborted)
          setLoadError(accountErrorMessage(reason, locale));
      });
    return () => controller.abort();
  }, [locale, reload, profile.id]);
  function start(action: typeof pending) {
    setError("");
    setMessage("");
    setPending(action);
  }
  async function exportData() {
    start("export");
    try {
      const response = await fetch("/api/account/export", {
        credentials: "same-origin",
        cache: "no-store",
        headers: { "X-Account-User": profile.id },
      });
      const document = await response.json();
      if (
        !response.ok ||
        document?.format !== "physical-chemistry-account" ||
        document?.version !== 1
      )
        throw new AccountRequestError(document?.code || "UNAVAILABLE");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(document, null, 2)], {
          type: "application/json",
        }),
      );
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `physical-chemistry-account-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        t(
          "个人学习备份已准备下载。",
          "Your personal study backup is ready to download.",
        ),
      );
    } catch (reason) {
      setError(accountErrorMessage(reason, locale));
    } finally {
      setPending(null);
    }
  }
  async function changeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    start("email");
    try {
      await accountRequest("/api/account/email-change", {
        method: "POST",
        accountUserId: profile.id,
        body: {
          email: fields.get("email"),
          currentPassword: fields.get("currentPassword"),
          locale,
        },
      });
      emailForm.current?.reset();
      setMessage(
        t(
          "确认邮件已分别发往旧邮箱和新邮箱。请在 30 分钟内打开两封邮件并分别确认；全部完成后，所有设备会退出登录。",
          "Confirmation emails were accepted for both your old and new inboxes. Confirm each within 30 minutes. Completing both signs out every device.",
        ),
      );
    } catch (reason) {
      setError(accountErrorMessage(reason, locale));
    } finally {
      setPending(null);
    }
  }
  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!understood || confirmation !== "DELETE") return;
    const fields = new FormData(event.currentTarget);
    start("delete");
    try {
      const result = await accountRequest<
        Result<{ deleted: boolean; cleanupPending?: boolean }>
      >("/api/account/delete", {
        method: "POST",
        accountUserId: profile.id,
        body: {
          confirmation,
          currentPassword: fields.get("currentPassword"),
          locale,
        },
      });
      if (result.data.deleted) {
        void getSession().catch(() => {});
        onDeleted(Boolean(result.data.cleanupPending));
      } else {
        setDeleteOpen(false);
        setUnderstood(false);
        setConfirmation("");
        setMessage(
          t(
            "注销确认邮件已提交发送。打开邮件后仍需明确确认，当前账户尚未注销。",
            "A deletion confirmation email was accepted. You must explicitly confirm from the email; your account has not been deleted yet.",
          ),
        );
      }
    } catch (reason) {
      setError(accountErrorMessage(reason, locale));
    } finally {
      setPending(null);
    }
  }
  async function retryCleanup() {
    start("cleanup");
    try {
      const result = await accountRequest<
        Result<{ remaining: number; removed: number }>
      >("/api/account/storage-cleanup", {
        method: "POST",
        accountUserId: profile.id,
        body: {},
      });
      setSummary((current) =>
        current
          ? { ...current, storageCleanupPending: result.data.remaining }
          : current,
      );
      setMessage(
        t(
          `本次清理 ${result.data.removed} 个文件，仍有 ${result.data.remaining} 个等待重试。`,
          `${result.data.removed} files cleaned up; ${result.data.remaining} remain queued for retry.`,
        ),
      );
    } catch (reason) {
      setError(accountErrorMessage(reason, locale));
    } finally {
      setPending(null);
    }
  }
  return (
    <section
      className="account-section"
      id="data"
      aria-labelledby="account-data-heading"
    >
      <header>
        <p className="eyebrow">04 · {t("数据与邮箱", "DATA & EMAIL")}</p>
        <h2 id="account-data-heading">
          {t("管理你的学习数据", "Manage your study data")}
        </h2>
        <p className="muted">
          {t(
            "下载自己的记录，安全更换邮箱，或关闭这个账户。",
            "Download your records, change your email safely or close this account.",
          )}
        </p>
      </header>
      <div className="account-section-body auth-stack">
        <div className="auth-stack">
          <h3>{t("导出个人数据", "Export your data")}</h3>
          <p className="auth-hint">
            {t(
              "下载 JSON 备份，包含个人资料、阅读设置、阅读位置、收藏、私人笔记和章节进度。备份不包含密码或登录凭据。",
              "Download a JSON backup of your profile, reading preferences and positions, bookmarks, private notes and chapter progress. Passwords and sign-in credentials are excluded.",
            )}
          </p>
          <div>
            <button
              className="button-secondary"
              type="button"
              disabled={pending !== null}
              onClick={exportData}
            >
              {pending === "export"
                ? t("正在准备…", "Preparing…")
                : t("下载个人备份", "Download my backup")}
            </button>
          </div>
        </div>
        {loadError && (
          <div className="auth-stack">
            <AuthFeedback message={loadError} />
            <button
              className="button-secondary"
              type="button"
              onClick={() => setReload((value) => value + 1)}
            >
              {t("重新读取安全选项", "Reload security options")}
            </button>
          </div>
        )}
        {!summary && !loadError && (
          <p className="muted" role="status">
            {t("正在读取安全选项…", "Loading security options…")}
          </p>
        )}
        <form
          ref={emailForm}
          className="auth-form border-t pt-6"
          onSubmit={changeEmail}
          aria-busy={pending === "email"}
        >
          <h3>{t("更换账户邮箱", "Change your account email")}</h3>
          <p className="auth-hint">
            {t(
              "需要分别确认当前邮箱和新邮箱。确认完成前，账户邮箱保持不变。Google 登录关联不会自动转移到另一个 Google 账号。",
              "Both your current and new mailboxes must confirm. Your account email stays unchanged until both confirmations finish. The Google sign-in connection is not transferred to another Google account.",
            )}
          </p>
          <p className="auth-hint">
            {t("当前邮箱：", "Current email: ")}
            {profile.email}
          </p>
          {summary?.mail === false && (
            <p className="notice" role="status">
              {t(
                "邮件服务尚未可用，暂时无法更换邮箱。",
                "Email delivery is unavailable, so email changes are temporarily unavailable.",
              )}
            </p>
          )}
          <AuthField
            label={t("新邮箱", "New email")}
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            disabled={pending !== null || !summary?.mail}
          />
          {profile.hasPassword && (
            <PasswordField
              label={t("当前密码", "Current password")}
              name="currentPassword"
              autoComplete="current-password"
              required
              maxLength={256}
              disabled={pending !== null || !summary?.mail}
            />
          )}
          <div>
            <button
              className="button-secondary"
              type="submit"
              disabled={pending !== null || !summary?.mail}
            >
              {pending === "email"
                ? t("正在提交…", "Requesting…")
                : t(
                    "向两个邮箱发送确认邮件",
                    "Send confirmations to both inboxes",
                  )}
            </button>
          </div>
        </form>
        <div className="auth-stack border-t pt-6">
          <h3>{t("注销账户", "Delete your account")}</h3>
          <p className="auth-hint">
            {t(
              "注销无法撤销。你的私人学习数据、密码和登录会话将被删除；已经用于公开文章的配图会保留。建议先下载备份。",
              "Deletion cannot be undone. Your private study data, password and sign-in sessions will be removed. Illustrations used by public articles remain available. Download a backup first.",
            )}
          </p>
          {!deleteOpen ? (
            <div>
              <button
                className="button-secondary text-red-700"
                type="button"
                disabled={
                  pending !== null ||
                  !summary ||
                  (!profile.hasPassword && !summary.mail)
                }
                onClick={() => {
                  setDeleteOpen(true);
                  setError("");
                  setMessage("");
                }}
              >
                {t("我想注销此账户", "I want to delete this account")}
              </button>
            </div>
          ) : (
            <form
              className="auth-form rounded border border-red-200 p-4"
              onSubmit={deleteAccount}
              aria-busy={pending === "delete"}
            >
              <p>
                {profile.hasPassword
                  ? t(
                      "本次提交会立即注销账户，请核对后继续。",
                      "Submitting this form immediately deletes the account. Review it carefully.",
                    )
                  : t(
                      "本次提交仅申请确认邮件；你仍需在邮件链接页面明确同意注销。",
                      "This requests a confirmation email. You must still explicitly approve deletion from the email link.",
                    )}
              </p>
              {profile.hasPassword && (
                <PasswordField
                  label={t("当前密码", "Current password")}
                  name="currentPassword"
                  autoComplete="current-password"
                  required
                  maxLength={256}
                  disabled={pending !== null}
                />
              )}
              <label className="flex items-start gap-3 text-sm">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={understood}
                  onChange={(event) => setUnderstood(event.target.checked)}
                  disabled={pending !== null}
                  required
                />
                <span>
                  {t(
                    "我了解这会永久删除私人记录，并已保存需要的备份。",
                    "I understand this permanently deletes my private records and I have saved any backup I need.",
                  )}
                </span>
              </label>
              <AuthField
                label={t("输入 DELETE 确认", "Type DELETE to confirm")}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                required
                disabled={pending !== null}
              />
              <div className="flex flex-wrap gap-3">
                <button
                  className="button-secondary text-red-700"
                  type="submit"
                  disabled={
                    pending !== null || !understood || confirmation !== "DELETE"
                  }
                >
                  {pending === "delete"
                    ? t("正在处理…", "Processing…")
                    : profile.hasPassword
                      ? t("永久注销账户", "Permanently delete account")
                      : t("发送注销确认邮件", "Send deletion confirmation")}
                </button>
                <button
                  className="button-ghost"
                  type="button"
                  disabled={pending !== null}
                  onClick={() => setDeleteOpen(false)}
                >
                  {t("取消", "Cancel")}
                </button>
              </div>
            </form>
          )}
        </div>
        {summary?.isAdmin && (
          <div className="auth-stack border-t pt-6">
            <h3>{t("管理员文件清理", "Administrator file cleanup")}</h3>
            <p className="auth-hint">
              {t(
                `有 ${summary.storageCleanupPending ?? 0} 个已移除头像的文件等待清理。每次只处理少量文件，失败项会保留。`,
                `${summary.storageCleanupPending ?? 0} removed-avatar files are queued. Each retry processes a small batch and keeps failed items queued.`,
              )}
            </p>
            <div>
              <button
                className="button-secondary"
                type="button"
                disabled={pending !== null || !summary.storageCleanupPending}
                onClick={retryCleanup}
              >
                {t("重试待清理文件", "Retry queued cleanup")}
              </button>
            </div>
          </div>
        )}
        <AuthFeedback message={error} />
        <AuthFeedback success message={message} />
      </div>
    </section>
  );
}
