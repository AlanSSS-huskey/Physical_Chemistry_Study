"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";
import {
  AccountRequestError,
  accountErrorMessage,
  accountRequest,
} from "@/components/auth/account-client";
import { AuthFeedback } from "@/components/auth/AuthFields";
import { ProfileSettings } from "./ProfileSettings";
import { SecuritySettings } from "./SecuritySettings";
import { SessionSettings } from "./SessionSettings";
import { AccountDataSettings } from "./AccountDataSettings";
import type { AccountProfile } from "./account-types";

export function AccountSettings() {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [deleted, setDeleted] = useState<{ cleanupPending: boolean } | null>(
    null,
  );
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    accountRequest<{ ok: true; data: AccountProfile }>("/api/account/profile", {
      signal: controller.signal,
    })
      .then((result) => setProfile(result.data))
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason);
      });
    return () => controller.abort();
  }, [attempt]);
  if (deleted)
    return (
      <section className="panel auth-stack p-8">
        <h1 className="page-heading">
          {t("账户已注销", "Your account has been deleted")}
        </h1>
        <AuthFeedback
          success
          message={t(
            "私人学习记录和登录会话已删除。公开文章配图会继续保留。",
            "Private study records and sign-in sessions have been removed. Public article illustrations remain available.",
          )}
        />
        {deleted.cleanupPending && (
          <p className="notice">
            {t(
              "头像文件已加入清理队列，等待管理员完成剩余清理。",
              "Avatar files are queued for the administrator to finish cleanup.",
            )}
          </p>
        )}
        <Link className="button" href="/">
          {t("返回首页", "Return home")}
        </Link>
      </section>
    );
  return (
    <div className="account-settings">
      <header className="account-page-heading">
        <Link className="text-link" href="/account">
          ← {t("我的学习", "My learning")}
        </Link>
        <p className="eyebrow">
          {t("让学习空间属于你", "YOUR SPACE, YOUR PREFERENCES")}
        </p>
        <h1 className="page-heading">{t("账户设置", "Account settings")}</h1>
        <p className="muted">
          {t(
            "个人资料、账户安全，以及你登录过的设备。",
            "Your profile, account security and the devices you use.",
          )}
        </p>
      </header>
      {error ? (
        <div className="panel auth-stack account-load-state">
          <AuthFeedback message={accountErrorMessage(error, locale)} />
          {error instanceof AccountRequestError &&
          error.code === "UNAUTHENTICATED" ? (
            <Link
              className="button"
              href="/login?callbackUrl=%2Faccount%2Fsettings"
            >
              {t("重新登录", "Sign in again")}
            </Link>
          ) : (
            <button
              className="button-secondary"
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
            >
              {t("重新加载账户", "Reload account")}
            </button>
          )}
        </div>
      ) : !profile ? (
        <div className="panel account-load-state" aria-busy="true">
          <p role="status">
            {t("正在读取账户设置…", "Loading your account settings…")}
          </p>
          <div className="account-loading-bars" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : (
        <>
          <nav
            className="account-section-nav"
            aria-label={t("账户设置目录", "Account settings sections")}
          >
            <a href="#profile">{t("个人资料", "Profile")}</a>
            <a href="#security">{t("账户安全", "Security")}</a>
            <a href="#sessions">{t("登录设备", "Sessions")}</a>
            <a href="#data">{t("数据与邮箱", "Data & email")}</a>
          </nav>
          <ProfileSettings
            profile={profile}
            onChange={(changes) =>
              setProfile((current) =>
                current ? { ...current, ...changes } : current,
              )
            }
          />
          <SecuritySettings profile={profile} />
          <SessionSettings />
          <AccountDataSettings
            profile={profile}
            onDeleted={(cleanupPending) => setDeleted({ cleanupPending })}
          />
        </>
      )}
    </div>
  );
}
