"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";
import {
  adminMutation,
  historyErrorMessage,
  HistoryRequestError,
} from "@/lib/content-history-client";
export function AdminRestoreButton({
  id,
  version,
  title,
}: {
  id: string;
  version: number;
  title: string;
}) {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function restore() {
    if (
      pending ||
      !window.confirm(
        t(
          `将「${title}」恢复为未发布草稿？检查后可在编辑器重新发布。`,
          `Restore “${title}” as an unpublished draft? Review it in the editor before publishing again.`,
        ),
      )
    )
      return;
    setPending(true);
    setError(null);
    try {
      const data = await adminMutation(
        `/api/admin/content/${encodeURIComponent(id)}/restore`,
        "POST",
        { expectedVersion: version },
      );
      if (data.ok !== true) throw new HistoryRequestError("UNAVAILABLE");
      router.refresh();
    } catch (failure) {
      setError(failure);
      setPending(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className="button-secondary text-xs"
        onClick={() => void restore()}
      >
        {pending
          ? t("正在恢复…", "Restoring…")
          : t("恢复为草稿", "Restore as draft")}
      </button>
      {Boolean(error) && (
        <p className="mt-2 text-xs text-red-800" role="alert">
          {historyErrorMessage(error, locale)}
        </p>
      )}
    </div>
  );
}
