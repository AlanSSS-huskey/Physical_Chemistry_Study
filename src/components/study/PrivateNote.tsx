"use client";

import { textFor, type Locale } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import type { StudyNote } from "@/lib/study-types";
import { useStudyResource } from "./useStudyResource";
import { SyncStatus } from "./SyncStatus";

export function PrivateNote({
  slug,
  locale,
  userId,
  canRead = true,
}: {
  slug: string;
  locale: Locale;
  userId: string;
  canRead?: boolean;
}) {
  const { locale: uiLocale } = useLocale();
  const query = new URLSearchParams({ slug, locale });
  const note = useStudyResource<StudyNote>(
    `/api/study/note?${query}`,
    userId,
    { body: "", revision: 0 },
    { slug, locale },
    900,
    true,
  );
  if (!canRead && note.errorCode === "NOT_FOUND") return null;
  return (
    <details className="study-note">
      <summary>
        {textFor(uiLocale, "我的本章笔记", "My chapter notes")}{" "}
        <span>{locale === "zh" ? "中文" : "English"}</span>
      </summary>
      <div className="study-note-editor">
        <p className="muted">
          {textFor(
            uiLocale,
            "仅你可见。中英文分别保存，输入后自动同步。",
            "Private to your account. Chinese and English notes are saved separately, with automatic sync.",
          )}
        </p>
        <label htmlFor={`private-note-${locale}`}>
          {textFor(
            uiLocale,
            "写下自己的解释、疑问或复习提示",
            "Your explanations, questions or revision prompts",
          )}
        </label>
        <textarea
          id={`private-note-${locale}`}
          maxLength={5000}
          rows={7}
          value={note.value.body}
          disabled={!note.ready}
          onChange={(event) =>
            note.setValue({ ...note.value, body: event.target.value })
          }
          placeholder={textFor(
            uiLocale,
            "例如：为什么恒压条件下焓变等于热量？",
            "For example: why does enthalpy change equal heat at constant pressure?",
          )}
        />
        <div className="study-note-footer">
          <span>{note.value.body.length} / 5000</span>
          <button
            type="button"
            className="study-text-button"
            onClick={note.retry}
            disabled={
              !note.ready ||
              ["synced", "saving", "conflict"].includes(note.phase)
            }
          >
            {textFor(uiLocale, "立即保存", "Save now")}
          </button>
        </div>
        <SyncStatus
          locale={uiLocale}
          phase={note.phase}
          errorCode={note.errorCode}
          retry={note.retry}
          onKeep={() => note.resolve("keep-local")}
          onUse={() => note.resolve("use-cloud")}
          remoteText={note.remote?.body}
        />
      </div>
    </details>
  );
}
