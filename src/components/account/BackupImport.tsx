"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useSession } from "next-auth/react";
import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";
import {
  accountErrorMessage,
  accountRequest,
  AccountRequestError,
} from "@/components/auth/account-client";
import { AuthFeedback } from "@/components/auth/AuthFields";
import {
  BACKUP_MAX_BYTES,
  BackupImportProblem,
  parseBackupImport,
  previewNeedsRefresh,
  type BackupApplyResult,
  type BackupPreview,
} from "./backup-import-client";
import { BackupImportPreview } from "./BackupImportPreview";
import "./backup-import.css";

export function BackupImport({
  accountUserId,
  accountLabel,
}: {
  accountUserId: string;
  accountLabel: string;
}) {
  const { data: session, status } = useSession();
  const { locale } = useLocale();
  if (status === "loading")
    return (
      <p role="status" className="auth-hint">
        {textFor(
          locale,
          "正在核对导入账户…",
          "Checking the destination account…",
        )}
      </p>
    );
  if (session?.user?.id !== accountUserId)
    return (
      <p className="notice" role="status">
        {textFor(
          locale,
          "账户已变化，请重新打开账户设置后选择备份。",
          "Your account changed. Reopen account settings before choosing a backup.",
        )}{" "}
        <a href="/account/settings">
          {textFor(locale, "重新打开", "Reopen settings")}
        </a>
      </p>
    );
  return (
    <OwnedBackupImport
      key={accountUserId}
      accountUserId={accountUserId}
      accountLabel={accountLabel}
    />
  );
}

function OwnedBackupImport({
  accountUserId,
  accountLabel,
}: {
  accountUserId: string;
  accountLabel: string;
}) {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  const [backup, setBackup] = useState<Record<string, unknown> | null>(null);
  const [filename, setFilename] = useState("");
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [result, setResult] = useState<BackupApplyResult | null>(null);
  const [mode, setMode] = useState<"keep-existing" | "replace-conflicts">(
    "keep-existing",
  );
  const [confirmed, setConfirmed] = useState(false);
  const [expired, setExpired] = useState(false);
  const [pending, setPending] = useState<
    "reading" | "preview" | "apply" | null
  >(null);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!preview) {
      setExpired(false);
      return;
    }
    const remaining = new Date(preview.expiresAt).getTime() - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) {
      setExpired(true);
      return;
    }
    setExpired(false);
    const timer = window.setTimeout(
      () => {
        setExpired(true);
        setConfirmed(false);
      },
      Math.min(remaining, 2147483647),
    );
    return () => window.clearTimeout(timer);
  }, [preview]);
  function clear() {
    generation.current++;
    request.current?.abort();
    setBackup(null);
    setFilename("");
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    setPending(null);
    setMode("keep-existing");
    if (input.current) input.current.value = "";
  }
  function message(reason: unknown) {
    const code =
      reason instanceof AccountRequestError ||
      reason instanceof BackupImportProblem
        ? reason.code
        : "UNAVAILABLE";
    const messages: Record<string, [string, string]> = {
      BACKUP_INVALID: [
        "请选择本网站导出的有效 JSON 备份。最多支持 100 条笔记、500 个收藏，每条笔记不超过 5000 个字符。",
        "Choose a valid JSON backup exported by this website, with up to 100 notes, 500 bookmarks and 5,000 characters per note.",
      ],
      BACKUP_TOO_LARGE: [
        "备份文件超过 1 MB，请选择较小的备份。",
        "The backup exceeds 1 MB. Choose a smaller backup file.",
      ],
      PREVIEW_INVALID: [
        "预览已失效，请重新预览后确认。",
        "This preview is no longer valid. Preview the backup again before confirming.",
      ],
      PREVIEW_EXPIRED: [
        "预览已超过 10 分钟，请重新预览后确认。",
        "This preview expired after 10 minutes. Preview it again before confirming.",
      ],
      PREVIEW_STALE: [
        "当前笔记或收藏已有变化。请重新预览并核对最新内容。",
        "Your notes or bookmarks changed. Preview again to review their latest state.",
      ],
      IMPORT_STALE: [
        "当前笔记或收藏已有变化。请重新预览并核对最新内容。",
        "Your notes or bookmarks changed. Preview again to review their latest state.",
      ],
      UNAVAILABLE: [
        "暂时无法确认这次请求的结果。请重新预览，核对已保存的记录后重试。",
        "This request could not be confirmed. Preview again and check the saved records before retrying.",
      ],
    };
    return (
      messages[code]?.[locale === "zh" ? 0 : 1] ||
      accountErrorMessage(reason, locale)
    );
  }
  function fail(reason: unknown, applying = false) {
    const code =
      reason instanceof AccountRequestError ? reason.code : "UNAVAILABLE";
    if (["SESSION_CHANGED", "UNAUTHENTICATED"].includes(code)) clear();
    else if (
      previewNeedsRefresh(code) ||
      (applying && code === "UNAVAILABLE")
    ) {
      setPreview(null);
      setConfirmed(false);
    }
    setError(message(reason));
  }
  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    generation.current++;
    const current = generation.current;
    request.current?.abort();
    setBackup(null);
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    setError("");
    setMode("keep-existing");
    setFilename(file?.name || "");
    if (!file) {
      setPending(null);
      return;
    }
    setPending("reading");
    try {
      if (file.size > BACKUP_MAX_BYTES)
        throw new BackupImportProblem("BACKUP_TOO_LARGE");
      const value = parseBackupImport(await file.text());
      if (mounted.current && current === generation.current) setBackup(value);
    } catch (reason) {
      if (mounted.current && current === generation.current)
        setError(message(reason));
    } finally {
      if (mounted.current && current === generation.current) setPending(null);
    }
  }
  async function createPreview() {
    if (!backup || pending) return;
    const abort = new AbortController();
    request.current?.abort();
    request.current = abort;
    setPending("preview");
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    setError("");
    setMode("keep-existing");
    try {
      const response = await accountRequest<{ ok: true; data: BackupPreview }>(
        "/api/account/import/preview",
        {
          method: "POST",
          body: { backup },
          accountUserId,
          signal: abort.signal,
        },
      );
      if (!abort.signal.aborted && mounted.current) setPreview(response.data);
    } catch (reason) {
      if (!abort.signal.aborted && mounted.current) fail(reason);
    } finally {
      if (!abort.signal.aborted && mounted.current) setPending(null);
    }
  }
  async function apply() {
    if (!backup || !preview || pending || expired || !confirmed) return;
    const abort = new AbortController();
    request.current?.abort();
    request.current = abort;
    setPending("apply");
    setError("");
    try {
      const response = await accountRequest<{
        ok: true;
        data: BackupApplyResult;
      }>("/api/account/import/apply", {
        method: "POST",
        body: {
          backup,
          previewToken: preview.previewToken,
          conflictMode: mode,
          confirm: true,
        },
        accountUserId,
        signal: abort.signal,
      });
      if (!abort.signal.aborted && mounted.current) {
        setResult(response.data);
        setPreview(null);
        setConfirmed(false);
      }
    } catch (reason) {
      if (!abort.signal.aborted && mounted.current) fail(reason, true);
    } finally {
      if (!abort.signal.aborted && mounted.current) setPending(null);
    }
  }
  return (
    <div className="backup-import auth-stack">
      <div>
        <h3>{t("导入笔记与收藏", "Import notes and bookmarks")}</h3>
        <p className="auth-hint">
          {t(
            "选择本网站导出的 JSON 备份（不超过 1 MB）。只恢复私人笔记和收藏，不更改个人资料、阅读设置、学习进度或课程权限；原文件不会被修改。",
            "Choose a JSON backup exported by this website, up to 1 MB. Only private notes and bookmarks are restored. Profile details, reading preferences, progress and course access stay as they are. Your original file is kept unchanged.",
          )}
        </p>
      </div>
      <p className="backup-import-destination">
        {t("导入到当前账户：", "Destination account: ")}
        <strong>{accountLabel}</strong>
      </p>
      <label className="backup-import-file">
        {t("选择 JSON 备份文件", "Choose a JSON backup file")}
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          disabled={pending !== null}
          onChange={(event) => {
            void chooseFile(event);
          }}
        />
      </label>
      {filename && (
        <p className="auth-hint backup-import-filename">{filename}</p>
      )}
      <AuthFeedback message={error} />
      {pending && (
        <p className="auth-hint" role="status">
          {t(
            pending === "reading"
              ? "正在检查文件…"
              : pending === "preview"
                ? "正在比较当前账户的记录…"
                : "正在导入笔记与收藏…",
            pending === "reading"
              ? "Checking the file…"
              : pending === "preview"
                ? "Comparing records with your current account…"
                : "Importing notes and bookmarks…",
          )}
        </p>
      )}
      {filename && !result && (
        <div className="backup-import-actions">
          {backup && (
            <button
              className="button-secondary"
              type="button"
              onClick={() => {
                void createPreview();
              }}
              disabled={pending !== null}
            >
              {t(
                preview ? "重新预览" : "预览导入内容",
                preview ? "Refresh preview" : "Preview import",
              )}
            </button>
          )}
          <button
            className="study-text-button"
            type="button"
            disabled={pending === "apply"}
            onClick={() => {
              clear();
              setError("");
            }}
          >
            {t("清除所选文件", "Clear selected file")}
          </button>
        </div>
      )}
      {preview && (
        <>
          <BackupImportPreview preview={preview} locale={locale} />
          {expired ? (
            <p className="notice" role="status">
              {t(
                "预览已过期。请重新预览，再核对并确认。",
                "This preview expired. Refresh it, review the records and confirm again.",
              )}
            </p>
          ) : (
            <p className="auth-hint">
              {t("本次预览有效至 ", "This preview is valid until ")}
              {new Date(preview.expiresAt).toLocaleTimeString(
                locale === "zh" ? "zh-CN" : "en-GB",
                { hour: "2-digit", minute: "2-digit" },
              )}
              {t(
                "。提交前仍会核对最新记录。",
                ". Records are checked again when you submit.",
              )}
            </p>
          )}
          {preview.notes.some((note) => note.status === "conflict") && (
            <fieldset
              className="backup-import-choice"
              disabled={pending !== null}
            >
              <legend>{t("出现文字冲突时", "When note text conflicts")}</legend>
              <label>
                <input
                  type="radio"
                  name="backup-conflict-mode"
                  checked={mode === "keep-existing"}
                  onChange={() => {
                    setMode("keep-existing");
                    setConfirmed(false);
                  }}
                />
                <span>
                  <strong>
                    {t(
                      "保留当前账户已有笔记（默认）",
                      "Keep the current account’s notes (default)",
                    )}
                  </strong>
                  <small>
                    {t(
                      "跳过冲突笔记，仍导入新的笔记和收藏。",
                      "Skip conflicting notes and still add new notes and bookmarks.",
                    )}
                  </small>
                </span>
              </label>
              <label>
                <input
                  type="radio"
                  name="backup-conflict-mode"
                  checked={mode === "replace-conflicts"}
                  onChange={() => {
                    setMode("replace-conflicts");
                    setConfirmed(false);
                  }}
                />
                <span>
                  <strong>
                    {t(
                      "用备份原文替换冲突笔记",
                      "Replace conflicting notes with the backup text",
                    )}
                  </strong>
                  <small>
                    {t(
                      "会覆盖上方展示的当前文字。请先阅读原文对比。",
                      "Overwrites the current text shown above. Review both versions first.",
                    )}
                  </small>
                </span>
              </label>
            </fieldset>
          )}
          <label className="backup-import-confirm">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={pending !== null || expired}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              {t(
                mode === "replace-conflicts"
                  ? "我已核对当前账户和原文，确认只导入笔记与收藏，并替换冲突笔记。"
                  : "我已核对当前账户和原文，确认只导入笔记与收藏，并保留已有冲突笔记。",
                mode === "replace-conflicts"
                  ? "I reviewed the account and original text. Import only notes and bookmarks, replacing conflicting notes."
                  : "I reviewed the account and original text. Import only notes and bookmarks, keeping existing conflicting notes.",
              )}
            </span>
          </label>
          <div>
            <button
              type="button"
              className="button"
              disabled={!confirmed || pending !== null || expired}
              onClick={() => {
                void apply();
              }}
            >
              {t("确认导入笔记与收藏", "Confirm import of notes and bookmarks")}
            </button>
          </div>
        </>
      )}
      {result && (
        <div className="backup-import-result" role="status">
          <h4>{t("笔记与收藏导入已完成", "Notes and bookmarks imported")}</h4>
          <p>
            {t(
              `新建 ${result.notesCreated} 条笔记，更新 ${result.notesUpdated} 条，跳过 ${result.notesSkipped} 条；新增 ${result.bookmarksAdded} 个收藏。`,
              `${result.notesCreated} notes created, ${result.notesUpdated} updated, ${result.notesSkipped} skipped; ${result.bookmarksAdded} bookmarks added.`,
            )}
          </p>
          <p className="auth-hint">
            {t(
              "此次没有恢复备份中的其他数据。原文件仍可保留作为备份。",
              "Other sections of the backup were not restored. Keep the original file as your backup.",
            )}
          </p>
          <div className="backup-import-actions">
            <Link href="/account/library" className="button-secondary">
              {t("查看笔记与收藏", "View notes and bookmarks")}
            </Link>
            <button
              className="study-text-button"
              type="button"
              onClick={() => {
                clear();
                setError("");
              }}
            >
              {t("选择另一份备份", "Choose another backup")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
