"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";
import { adminErrorMessage, readApiObject } from "@/lib/editor";
import {
  adminMutation,
  historyErrorMessage,
} from "@/lib/content-history-client";

type Props = {
  endpoint: string;
  title: string;
  kind: "content" | "image";
  onDeleted?: () => void;
  expectedVersion?: number;
};

export function AdminDeleteButton({
  endpoint,
  title,
  kind,
  onDeleted,
  expectedVersion,
}: Props) {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    const warning =
      kind === "image"
        ? t(
            `确定删除图片「${title}」吗？引用此图片的文章将无法显示它。此操作无法撤销。`,
            `Delete the image “${title}”? Articles using this image will lose it. This cannot be undone.`,
          )
        : t(
            `将文章「${title}」移入回收站？它会停止展示，文章与翻译仍可恢复。`,
            `Move “${title}” to the trash? It will leave the reading library. The article and translations can be restored.`,
          );
    if (pending || deleted || !window.confirm(warning)) return;
    setPending(true);
    setError("");
    try {
      if (kind === "content") {
        const data = await adminMutation(endpoint, "DELETE", {
          expectedVersion,
        });
        if (data.ok !== true) throw new Error("UNAVAILABLE");
      } else {
        const response = await fetch(endpoint, { method: "DELETE" });
        const data = await readApiObject(response);
        if (!response.ok || data.ok !== true) {
          setError(
            adminErrorMessage(
              typeof data.code === "string" ? data.code : undefined,
              response.status,
              locale,
            ),
          );
          return;
        }
      }
      setDeleted(true);
      onDeleted?.();
      router.refresh();
    } catch (failure) {
      setError(
        kind === "content"
          ? historyErrorMessage(failure, locale)
          : adminErrorMessage("UNAVAILABLE", 0, locale),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="button-ghost px-2 py-1.5 text-xs text-red-800 hover:bg-red-50"
        onClick={() => void remove()}
        disabled={
          pending || deleted || (kind === "content" && !expectedVersion)
        }
        aria-label={
          kind === "content"
            ? t(`移入回收站 ${title}`, `Move ${title} to trash`)
            : t(`删除 ${title}`, `Delete ${title}`)
        }
      >
        {pending
          ? kind === "content"
            ? t("正在移入…", "Moving…")
            : t("正在删除…", "Deleting…")
          : deleted
            ? kind === "content"
              ? t("已移入回收站", "Moved to trash")
              : t("已删除", "Deleted")
            : kind === "content"
              ? t("回收", "Trash")
              : t("删除", "Delete")}
      </button>
      {pending && (
        <span className="sr-only" role="status">
          {t(`正在删除 ${title}`, `Deleting ${title}`)}
        </span>
      )}
      {error && (
        <p className="max-w-xs text-xs leading-5 text-red-800" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
