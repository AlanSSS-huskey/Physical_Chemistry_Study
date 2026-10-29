"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";
import {
  accountErrorMessage,
  accountRequest,
} from "@/components/auth/account-client";
import { AuthFeedback } from "@/components/auth/AuthFields";
import type { AccountDeviceSession } from "./account-types";

export function SessionSettings() {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  const [sessions, setSessions] = useState<AccountDeviceSession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await accountRequest<{
        ok: true;
        data: { sessions: AccountDeviceSession[] };
      }>("/api/account/sessions");
      setSessions(result.data.sessions);
    } catch (reason) {
      setError(accountErrorMessage(reason, locale));
    } finally {
      setLoading(false);
    }
  }, [locale]);
  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(id: string) {
    setPending(id);
    setError("");
    setSuccess("");
    try {
      await accountRequest(
        id === "others"
          ? "/api/account/sessions"
          : `/api/account/sessions/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      setSessions(
        (items) =>
          items?.filter((item) =>
            id === "others" ? item.current : item.id !== id,
          ) ?? [],
      );
      setSuccess(
        id === "others"
          ? t("其他设备已退出登录。", "Other devices have been signed out.")
          : t("该设备已退出登录。", "The device has been signed out."),
      );
      setConfirming(null);
    } catch (reason) {
      setError(accountErrorMessage(reason, locale));
    } finally {
      setPending(null);
    }
  }

  function date(value: string) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? "—"
      : new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(parsed);
  }

  return (
    <section
      className="account-section"
      id="sessions"
      aria-labelledby="sessions-heading"
    >
      <header>
        <p className="eyebrow">03 · {t("登录设备", "SESSIONS")}</p>
        <h2 id="sessions-heading">
          {t("知道谁在登录", "Know where you’re signed in")}
        </h2>
        <p className="muted">
          {t(
            "查看有效的登录会话，退出不再使用的设备。",
            "Review active sessions and sign out devices you no longer use.",
          )}
        </p>
      </header>
      <div className="account-section-body">
        <div className="account-session-toolbar">
          <p className="auth-hint">
            {t(
              "设备名称根据浏览器信息识别，仅供参考。",
              "Device names are estimated from browser information.",
            )}
          </p>
          <button
            className="button-ghost"
            type="button"
            onClick={() => void load()}
            disabled={loading || !!pending}
          >
            {t("刷新列表", "Refresh list")}
          </button>
        </div>
        <AuthFeedback message={error} />
        <AuthFeedback message={success} success />
        {loading && sessions === null ? (
          <p className="auth-loading" role="status">
            {t("正在加载登录会话…", "Loading active sessions…")}
          </p>
        ) : sessions && sessions.length === 0 ? (
          <p className="notice" role="status">
            {t(
              "没有可显示的有效登录会话。",
              "There are no active sessions to display.",
            )}
          </p>
        ) : (
          sessions && (
            <ul className="account-session-list">
              {sessions.map((session) => (
                <li key={session.id}>
                  <div className="account-device-icon" aria-hidden="true">
                    ▱
                  </div>
                  <div className="account-device-details">
                    <div className="account-device-title">
                      <h3>
                        {!session.device || session.device === "Unknown browser"
                          ? t("未知浏览器", "Unknown browser")
                          : session.device}
                      </h3>
                      {session.current && (
                        <span className="badge">
                          {t("当前设备", "This device")}
                        </span>
                      )}
                    </div>
                    <p className="auth-hint">
                      {session.remembered
                        ? t("已记住登录状态", "Remembered sign-in")
                        : t("浏览器会话", "Browser session")}
                    </p>
                    <dl>
                      <div>
                        <dt>{t("最近活动", "Last active")}</dt>
                        <dd>{date(session.lastActiveAt)}</dd>
                      </div>
                      <div>
                        <dt>{t("会话到期", "Expires")}</dt>
                        <dd>{date(session.expiresAt)}</dd>
                      </div>
                    </dl>
                    {confirming === session.id && (
                      <div
                        className="account-revoke-confirm"
                        role="group"
                        aria-label={t(
                          "确认退出此设备",
                          "Confirm sign-out for this device",
                        )}
                      >
                        <p>
                          {t(
                            "退出此设备后，需要重新登录才能访问账户。",
                            "This device will need to sign in again to access your account.",
                          )}
                        </p>
                        <div>
                          <button
                            autoFocus
                            className="button-secondary account-danger"
                            type="button"
                            onClick={() => void revoke(session.id)}
                            disabled={!!pending}
                          >
                            {pending === session.id
                              ? t("正在退出…", "Signing out…")
                              : t("确认退出", "Confirm sign out")}
                          </button>
                          <button
                            className="button-ghost"
                            type="button"
                            onClick={() => setConfirming(null)}
                            disabled={!!pending}
                          >
                            {t("取消", "Cancel")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {!session.current && confirming !== session.id && (
                    <button
                      className="button-ghost account-revoke"
                      type="button"
                      onClick={() => setConfirming(session.id)}
                      disabled={!!pending}
                      aria-label={t(
                        `退出设备：${session.device}`,
                        `Sign out device: ${session.device}`,
                      )}
                    >
                      {t("退出", "Sign out")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )
        )}
        {sessions?.some((session) => !session.current) && (
          <div className="account-revoke-others">
            {confirming === "others" ? (
              <div
                className="account-revoke-confirm"
                role="group"
                aria-label={t(
                  "确认退出其他设备",
                  "Confirm sign out other devices",
                )}
              >
                <p>
                  {t(
                    "其他所有设备都将退出登录，当前设备会保留。",
                    "All other devices will be signed out. This device will stay signed in.",
                  )}
                </p>
                <div>
                  <button
                    autoFocus
                    className="button-secondary account-danger"
                    type="button"
                    onClick={() => void revoke("others")}
                    disabled={!!pending}
                  >
                    {pending === "others"
                      ? t("正在退出…", "Signing out…")
                      : t("确认退出其他设备", "Confirm sign out other devices")}
                  </button>
                  <button
                    className="button-ghost"
                    type="button"
                    onClick={() => setConfirming(null)}
                    disabled={!!pending}
                  >
                    {t("取消", "Cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="button-secondary"
                type="button"
                onClick={() => setConfirming("others")}
                disabled={!!pending}
              >
                {t("退出其他所有设备", "Sign out all other devices")}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
