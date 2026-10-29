"use client";

import Link from "next/link";
import { textFor, type Locale } from "@/lib/i18n";
import type { StudySyncPhase } from "./useStudyResource";

export function SyncStatus({
  phase,
  locale,
  errorCode,
  retry,
  onKeep,
  onUse,
  remoteText,
}: {
  phase: StudySyncPhase;
  locale: Locale;
  errorCode?: string | null;
  retry(): void;
  onKeep?: () => void;
  onUse?: () => void;
  remoteText?: string;
}) {
  const message = {
    loading: textFor(locale, "正在读取云端记录…", "Loading your saved record…"),
    synced: textFor(locale, "已同步", "Synced"),
    pending: textFor(
      locale,
      "待同步 · 当前页面保留",
      "Pending sync · kept on this page",
    ),
    saving: textFor(locale, "正在保存…", "Saving…"),
    error: textFor(
      locale,
      "尚未同步，请重试。关闭页面前请保留未保存内容。",
      "Not synced. Retry before leaving, or keep a copy of unsaved text.",
    ),
    conflict: textFor(
      locale,
      "另一台设备已修改。你的内容仍保留，请选择如何处理。",
      "Changed on another device. Your edit is kept; choose how to resolve it.",
    ),
    local: textFor(locale, "仅保存在此浏览器", "Saved in this browser only"),
  }[phase];
  const changedAccount = ["SESSION_CHANGED", "UNAUTHENTICATED"].includes(
    errorCode || "",
  );
  return (
    <div className={`study-sync study-sync-${phase}`}>
      <p role="status" aria-live="polite">
        {changedAccount
          ? textFor(
              locale,
              "登录账户已变化，请重新打开本页后继续。",
              "Your signed-in account changed. Reopen this page to continue.",
            )
          : message}
      </p>
      {phase === "error" && !changedAccount && (
        <button type="button" className="study-text-button" onClick={retry}>
          {textFor(locale, "重试同步", "Retry sync")}
        </button>
      )}
      {changedAccount && (
        <Link href="/login" className="study-text-button">
          {textFor(locale, "重新登录", "Sign in again")}
        </Link>
      )}
      {phase === "conflict" && (
        <div className="study-conflict">
          {remoteText !== undefined && (
            <details>
              <summary>
                {textFor(locale, "查看云端版本", "View the cloud version")}
              </summary>
              <pre>{remoteText || textFor(locale, "（空白）", "(Empty)")}</pre>
            </details>
          )}
          <div className="study-actions">
            <button type="button" className="button-secondary" onClick={onUse}>
              {textFor(locale, "使用云端版本", "Use cloud version")}
            </button>
            <button type="button" className="button-secondary" onClick={onKeep}>
              {textFor(locale, "用我的内容重新保存", "Save my version instead")}
            </button>
          </div>
          <p>
            {textFor(
              locale,
              "可先复制云端文字，合并到你的内容，再选择重新保存。",
              "You can first copy the cloud text into your edit, then save your merged version.",
            )}
          </p>
        </div>
      )}
    </div>
  );
}
