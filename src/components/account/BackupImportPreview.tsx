"use client";

import { textFor, type Locale } from "@/lib/i18n";
import {
  summarizeBackupPreview,
  type BackupPreview,
} from "./backup-import-client";

export function BackupImportPreview({
  preview,
  locale,
}: {
  preview: BackupPreview;
  locale: Locale;
}) {
  const summary = summarizeBackupPreview(preview);
  return (
    <div className="backup-import-preview">
      <dl className="backup-import-counts">
        {[
          [textFor(locale, "将新建笔记", "Notes to create"), summary.notesNew],
          [
            textFor(locale, "相同笔记跳过", "Identical notes to skip"),
            summary.notesIdentical,
          ],
          [
            textFor(locale, "需要选择的冲突", "Conflicting notes"),
            summary.notesConflicting,
          ],
          [
            textFor(locale, "将新增收藏", "Bookmarks to add"),
            summary.bookmarksNew,
          ],
          [
            textFor(locale, "已有收藏跳过", "Existing bookmarks to skip"),
            summary.bookmarksExisting,
          ],
        ].map(([label, count]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{count}</dd>
          </div>
        ))}
      </dl>
      {preview.sourceAccountDifferent && (
        <p className="notice">
          {textFor(
            locale,
            "备份来自另一个账户。只会把笔记和收藏恢复到当前账户，不会合并账户资料或权限。",
            "This backup came from another account. Its notes and bookmarks will be restored to your current account; profiles and access rights are not merged.",
          )}
        </p>
      )}
      {preview.notes.length > 0 && (
        <div className="backup-import-notes">
          <h4>
            {textFor(locale, "核对笔记原文", "Review the original note text")}
          </h4>
          {preview.notes.map((note) => (
            <details
              key={`${note.slug}:${note.locale}`}
              open={note.status === "conflict"}
            >
              <summary>
                <span>
                  {note.slug} · {note.locale === "zh" ? "中文" : "English"}
                </span>
                <strong>
                  {textFor(
                    locale,
                    note.status === "new"
                      ? "新建"
                      : note.status === "identical"
                        ? "相同，跳过"
                        : "冲突",
                    note.status === "new"
                      ? "New"
                      : note.status === "identical"
                        ? "Identical · skip"
                        : "Conflict",
                  )}
                </strong>
              </summary>
              <div className="backup-import-comparison">
                <div>
                  <h5>
                    {textFor(
                      locale,
                      "当前账户已有文字",
                      "Current account text",
                    )}
                  </h5>
                  <pre>
                    {note.currentBody === null
                      ? textFor(
                          locale,
                          "（没有现有笔记）",
                          "(No existing note)",
                        )
                      : note.currentBody ||
                        textFor(locale, "（空白笔记）", "(Empty note)")}
                  </pre>
                </div>
                <div>
                  <h5>
                    {textFor(locale, "备份里的文字", "Text from the backup")}
                  </h5>
                  <pre>
                    {note.incomingBody ||
                      textFor(locale, "（空白笔记）", "(Empty note)")}
                  </pre>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
