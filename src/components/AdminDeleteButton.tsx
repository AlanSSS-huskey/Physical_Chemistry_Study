"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";
import { adminErrorMessage, readApiObject } from "@/lib/editor";

type Props = {
  endpoint: string;
  title: string;
  kind: "content" | "image";
  onDeleted?: () => void;
};

export function AdminDeleteButton({ endpoint, title, kind, onDeleted }: Props) {
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
            `确定删除文章「${title}」及其所有翻译吗？此操作无法撤销。`,
            `Delete “${title}” and all its translations? This cannot be undone.`,
          );
    if (pending || deleted || !window.confirm(warning)) return;
    setPending(true);
    setError("");
    try {
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
      setDeleted(true);
      onDeleted?.();
      router.refresh();
    } catch {
      setError(adminErrorMessage("UNAVAILABLE", 0, locale));
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
        disabled={pending || deleted}
        aria-label={t(`删除 ${title}`, `Delete ${title}`)}
      >
        {pending
          ? t("正在删除…", "Deleting…")
          : deleted
            ? t("已删除", "Deleted")
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
