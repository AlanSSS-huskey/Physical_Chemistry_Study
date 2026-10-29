"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";
import { readApiObject, readTranslationDrafts } from "@/lib/editor";
import {
  adminMutation,
  historyErrorMessage,
  HistoryRequestError,
} from "@/lib/content-history-client";
import "./admin-recovery.css";

type Revision = {
  version: number;
  action: string;
  createdAt: string;
  actorName: string | null;
};
type Preview = { version: number; snapshot: Record<string, unknown> };
export function ContentHistoryPanel({
  contentId,
  version,
  hasUnsavedChanges = false,
}: {
  contentId: string;
  version: number;
  hasUnsavedChanges?: boolean;
}) {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  const router = useRouter();
  const [items, setItems] = useState<Revision[] | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const endpoint = `/api/admin/content/${encodeURIComponent(contentId)}`;
  const actions: Record<string, string> = {
    baseline: t("原有版本", "Original version"),
    create: t("新建", "Created"),
    save: t("保存", "Saved"),
    trash: t("移入回收站", "Moved to trash"),
    restore: t("恢复为草稿", "Restored as draft"),
  };
  async function load(path: string) {
    const response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
    });
    const result = await readApiObject(response);
    if (
      !response.ok ||
      result.ok !== true ||
      !result.data ||
      typeof result.data !== "object"
    )
      throw new HistoryRequestError(
        typeof result.code === "string" ? result.code : "UNAVAILABLE",
        response.status,
      );
    return result.data as Record<string, unknown>;
  }
  async function list(before?: number) {
    setPending(true);
    setError(null);
    try {
      const data = await load(
        `${endpoint}/history${before === undefined ? "" : `?before=${before}`}`,
      );
      if (!Array.isArray(data.revisions))
        throw new HistoryRequestError("UNAVAILABLE");
      const page = data.revisions as Revision[];
      setItems((existing) =>
        before === undefined ? page : [...(existing ?? []), ...page],
      );
      setNextBefore(
        typeof data.nextBefore === "number" ? data.nextBefore : null,
      );
    } catch (failure) {
      setError(failure);
    } finally {
      setPending(false);
    }
  }
  async function inspect(revision: number) {
    setPending(true);
    setError(null);
    try {
      const data = await load(`${endpoint}/history/${revision}`);
      if (!data.snapshot || typeof data.snapshot !== "object")
        throw new HistoryRequestError("UNAVAILABLE");
      setPreview({
        version: revision,
        snapshot: data.snapshot as Record<string, unknown>,
      });
    } catch (failure) {
      setError(failure);
    } finally {
      setPending(false);
    }
  }
  async function restore(revision: number) {
    const warning = hasUnsavedChanges
      ? t(
          "编辑器还有未保存的修改。恢复历史版本后这些修改不会写入文章。确定将所选历史版本恢复为未发布草稿吗？",
          "The editor contains unsaved changes. They will not be written to the article. Restore this historical version as an unpublished draft?",
        )
      : t(
          "将此历史版本恢复为未发布草稿？当前版本仍会保留在历史中，请检查后重新发布。",
          "Restore this version as an unpublished draft? The current version remains in history. Review it before publishing again.",
        );
    if (pending || !window.confirm(warning)) return;
    setPending(true);
    setError(null);
    try {
      const result = await adminMutation(`${endpoint}/restore`, "POST", {
        expectedVersion: version,
        version: revision,
      });
      if (result.ok !== true) throw new HistoryRequestError("UNAVAILABLE");
      router.refresh();
    } catch (failure) {
      setError(failure);
      setPending(false);
    }
  }
  const translations = preview
    ? readTranslationDrafts(
        typeof preview.snapshot.title === "string"
          ? preview.snapshot.title
          : "",
        typeof preview.snapshot.body === "string" ? preview.snapshot.body : "",
        preview.snapshot.translations,
      )
    : null;
  return (
    <details
      className="admin-history panel"
      onToggle={(event) => {
        if (event.currentTarget.open && !items && !pending) void list();
      }}
    >
      <summary className="cursor-pointer px-4 py-4 font-semibold">
        {t("版本历史与恢复", "Version history & recovery")}{" "}
        <span className="ml-2 text-xs font-normal muted">
          {t(`当前 v${version}`, `Current v${version}`)}
        </span>
      </summary>
      <div className="space-y-4 border-t border-[var(--border)] p-4">
        <p className="text-sm muted">
          {t(
            "自动草稿仅对你可见。这里保留每次正式保存、回收和恢复的版本；恢复会新建一个未发布版本。",
            "Automatic drafts are private to you. This history preserves article saves, trash actions and recoveries. Restoring creates a new unpublished version.",
          )}
        </p>
        {pending && (
          <p role="status" className="text-sm muted">
            {t("正在读取或恢复…", "Loading or restoring…")}
          </p>
        )}
        {Boolean(error) && (
          <div className="notice notice-error" role="alert">
            {historyErrorMessage(error, locale)}{" "}
            <button
              type="button"
              className="button-ghost"
              onClick={() => void list()}
            >
              {t("重试", "Retry")}
            </button>
          </div>
        )}
        {items?.length === 0 && (
          <p className="text-sm muted">
            {t(
              "此文章尚无历史记录，下一次保存时会保留原有版本。",
              "No history yet. The next save will also preserve the original version.",
            )}
          </p>
        )}
        {items && items.length > 0 && (
          <ul className="admin-history-list">
            {items.map((item) => (
              <li key={item.version}>
                <div>
                  <strong>v{item.version}</strong>{" "}
                  <span className="text-sm">
                    {actions[item.action] ?? actions.save}
                  </span>
                  <p className="mt-1 text-xs muted">
                    <time dateTime={item.createdAt}>
                      {new Date(item.createdAt).toLocaleString(
                        locale === "zh" ? "zh-CN" : "en-GB",
                      )}
                    </time>
                    {item.actorName ? ` · ${item.actorName}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="button-secondary text-xs"
                    disabled={pending}
                    onClick={() => void inspect(item.version)}
                  >
                    {t("查看内容", "View content")}
                  </button>
                  <button
                    type="button"
                    className="button-ghost text-xs"
                    disabled={pending}
                    onClick={() => void restore(item.version)}
                  >
                    {t("恢复为草稿", "Restore as draft")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {nextBefore !== null && (
          <button
            type="button"
            className="button-secondary text-xs"
            disabled={pending}
            onClick={() => void list(nextBefore)}
          >
            {t("载入更早版本", "Load older versions")}
          </button>
        )}
        {preview && translations && (
          <section
            className="admin-history-preview"
            aria-label={t(
              `版本 ${preview.version} 内容`,
              `Version ${preview.version} content`,
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">
                {t(
                  `版本 ${preview.version} 原文`,
                  `Version ${preview.version} source`,
                )}
              </h3>
              <button
                type="button"
                className="button-ghost text-xs"
                onClick={() => setPreview(null)}
              >
                {t("关闭预览", "Close preview")}
              </button>
            </div>
            {(["zh", "en"] as const).map((language) => (
              <div key={language} className="mt-4">
                <h4 className="text-xs font-semibold muted">
                  {language === "zh" ? "中文" : "English"}
                </h4>
                <p className="mt-2 font-semibold break-words">
                  {translations[language].title || t("未填写", "Not provided")}
                </p>
                <pre>
                  {translations[language].body || t("没有正文", "No body")}
                </pre>
              </div>
            ))}
          </section>
        )}
      </div>
    </details>
  );
}
