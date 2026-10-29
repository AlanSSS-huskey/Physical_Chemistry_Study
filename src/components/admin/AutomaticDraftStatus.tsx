"use client";

import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";
import { historyErrorMessage } from "@/lib/content-history-client";
import type { usePrivateDraft } from "./usePrivateDraft";

export function AutomaticDraftStatus({
  draft,
  version,
}: {
  draft: ReturnType<typeof usePrivateDraft>;
  version: number;
}) {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  return (
    <div className="admin-recovery-status">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs muted" role="status" aria-live="polite">
          {draft.state === "loading"
            ? t("正在检查自动草稿…", "Checking automatic drafts…")
            : draft.state === "saving"
              ? t("正在保存私人草稿…", "Saving your private draft…")
              : draft.state === "saved"
                ? t(
                    "私人草稿已自动保存；文章尚未发布更新。",
                    "Private draft saved automatically. The published article has not changed.",
                  )
                : draft.state === "error" || draft.state === "conflict"
                  ? t("自动保存已暂停。", "Automatic saving paused.")
                  : t(
                      "编辑时将自动保存私人草稿。",
                      "Your private draft saves automatically as you write.",
                    )}
        </p>
        {draft.updatedAt && (
          <time className="text-xs muted" dateTime={draft.updatedAt}>
            {new Date(draft.updatedAt).toLocaleTimeString(
              locale === "zh" ? "zh-CN" : "en-GB",
              { hour: "2-digit", minute: "2-digit" },
            )}
          </time>
        )}
      </div>
      {draft.recovery && (
        <div className="notice mt-3 space-y-3" role="status">
          <p className="font-semibold">
            {t("找到你的自动草稿", "Your automatic draft is available")}
          </p>
          <p className="text-sm">
            {t(
              "上次未完成的内容仍可恢复。恢复仅放入编辑器，点击“保存文章”才会更新文章。",
              "Recover your unfinished writing into the editor. The article changes only when you choose “Save article”.",
            )}
          </p>
          {draft.recovery.baseVersion !== null &&
            draft.recovery.baseVersion !== version && (
              <p className="text-sm">
                {t(
                  "文章在此草稿之后有过更新，请恢复后对照版本历史检查，避免覆盖新内容。",
                  "The article changed after this draft. Compare the version history before saving to avoid replacing newer work.",
                )}
              </p>
            )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="button-secondary"
              onClick={() => void draft.recover()}
            >
              {t("恢复到编辑器", "Recover into editor")}
            </button>
            <button
              type="button"
              className="button-ghost"
              onClick={() => {
                if (
                  window.confirm(
                    t(
                      "丢弃此私人自动草稿？文章和历史版本不会被删除。",
                      "Discard this private automatic draft? The article and version history remain available.",
                    ),
                  )
                )
                  void draft.discard();
              }}
            >
              {t("丢弃自动草稿", "Discard automatic draft")}
            </button>
          </div>
        </div>
      )}
      {Boolean(draft.error) && (
        <div className="notice notice-error mt-3" role="alert">
          <p>{historyErrorMessage(draft.error, locale)}</p>
          {draft.state !== "conflict" && !draft.recovery && (
            <button
              type="button"
              className="button-secondary mt-3"
              onClick={() => {
                if (draft.ready) void draft.retry().catch(() => {});
                else void draft.load();
              }}
            >
              {t("重试自动保存", "Retry automatic saving")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
