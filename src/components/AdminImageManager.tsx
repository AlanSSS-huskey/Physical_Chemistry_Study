"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { useLocale } from "@/components/LocaleProvider";
import { formatDate, textFor } from "@/lib/i18n";
import { adminErrorMessage, readApiObject, imageMarkdown } from "@/lib/editor";

type ImageItem = {
  id: string;
  url: string;
  filename: string;
  size: number;
  createdAt: string;
};

export function AdminImageManager({ items }: { items: ImageItem[] }) {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const visible = items.filter((item) =>
    item.filename.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );

  async function upload(file: File) {
    if (uploadingRef.current) return;
    setError("");
    setMessage("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError(
        t(
          "请选择 PNG、JPG 或 WebP 图片。",
          "Choose a PNG, JPG, or WebP image.",
        ),
      );
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t("图片不能超过 5 MB。", "Images must be 5 MB or smaller."));
      return;
    }
    uploadingRef.current = true;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: form,
      });
      const data = await readApiObject(response);
      if (!response.ok || typeof data.url !== "string" || !data.url) {
        setError(
          adminErrorMessage(
            typeof data.code === "string" ? data.code : undefined,
            response.status,
            locale,
          ),
        );
        return;
      }
      setMessage(
        t(
          `已上传「${file.name}」。可复制链接后插入文章。`,
          `“${file.name}” uploaded. Copy its URL to use it in an article.`,
        ),
      );
      router.refresh();
    } catch {
      setError(adminErrorMessage("UNAVAILABLE", 0, locale));
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      setDragging(false);
    }
  }

  async function copy(item: ImageItem, asMarkdown: boolean) {
    setError("");
    setMessage("");
    try {
      await navigator.clipboard.writeText(
        asMarkdown ? imageMarkdown(item.filename, item.url).trim() : item.url,
      );
      setMessage(
        asMarkdown
          ? t(
              "图片 Markdown 已复制，可粘贴到文章正文。",
              "Image Markdown copied. Paste it into an article body.",
            )
          : t("图片链接已复制。", "Image URL copied."),
      );
    } catch {
      setError(
        t(
          "无法访问剪贴板。请打开图片后从地址栏复制链接。",
          "Clipboard access failed. Open the image and copy the URL from the address bar.",
        ),
      );
    }
  }

  return (
    <div className="space-y-6">
      <div
        className={`panel flex flex-col items-start justify-between gap-4 border-dashed p-5 sm:flex-row sm:items-center ${dragging ? "ring-2 ring-[var(--accent)]" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file) void upload(file);
        }}
      >
        <div>
          <h2 className="section-heading">
            {t("上传图片", "Upload an image")}
          </h2>
          <p className="muted mt-1 text-sm">
            {t(
              "拖放到此处，或选择文件。支持 PNG、JPG 和 WebP，最大 5 MB。上传后的图片链接可公开分享。",
              "Drop a file here or browse. PNG, JPG, and WebP; up to 5 MB. Uploaded image links can be shared publicly.",
            )}
          </p>
        </div>
        <input
          ref={inputRef}
          className="sr-only"
          tabIndex={-1}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label={t("选择图片文件", "Choose image file")}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.currentTarget.value = "";
          }}
        />
        <button
          type="button"
          className="button shrink-0"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading
            ? t("正在上传…", "Uploading…")
            : t("选择图片", "Choose image")}
        </button>
      </div>
      {uploading && (
        <p className="notice" role="status">
          {t("正在保存图片到媒体库…", "Saving image to the media library…")}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="section-heading">{t("媒体库", "Media library")}</h2>
          <p className="mt-1 text-xs muted">
            {t(
              `${items.length} 张图片`,
              `${items.length} ${items.length === 1 ? "image" : "images"}`,
            )}
          </p>
        </div>
        <div className="w-full sm:w-72">
          <label
            htmlFor="image-search"
            className="mb-2 block text-xs font-semibold"
          >
            {t("按文件名查找", "Find by filename")}
          </label>
          <input
            id="image-search"
            type="search"
            className="input w-full"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("搜索图片…", "Search images…")}
          />
        </div>
      </div>
      {visible.length === 0 ? (
        <div className="panel py-12 text-center" role="status">
          <p className="font-semibold">
            {items.length === 0
              ? t("媒体库还是空的", "Your media library is empty")
              : t("没有找到匹配的图片", "No images match your search")}
          </p>
          <p className="muted mx-auto mt-2 max-w-md px-4 text-sm">
            {items.length === 0
              ? t(
                  "上传第一张示意图或实验图片，再将它插入双语学习笔记。",
                  "Upload your first diagram or experiment photo, then add it to a bilingual study note.",
                )
              : t(
                  "尝试使用不同的文件名，或清空搜索。",
                  "Try another filename, or clear the search.",
                )}
          </p>
          {query && (
            <button
              className="button-secondary mt-4"
              type="button"
              onClick={() => setQuery("")}
            >
              {t("清空搜索", "Clear search")}
            </button>
          )}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="list">
          {visible.map((item) => (
            <li key={item.id} className="panel min-w-0 overflow-hidden">
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="block border-b border-[var(--border)] bg-[var(--background)] p-3"
                aria-label={t(
                  `打开图片 ${item.filename}（新窗口）`,
                  `Open ${item.filename} (new window)`,
                )}
              >
                <Image
                  src={item.url}
                  alt={item.filename}
                  width={640}
                  height={360}
                  unoptimized
                  className="h-44 w-full object-contain"
                />
              </a>
              <div className="space-y-3 p-4">
                <div>
                  <h3 className="break-all text-sm font-semibold">
                    {item.filename}
                  </h3>
                  <p className="mt-1 break-all font-mono text-xs muted">
                    {item.url}
                  </p>
                  <p className="mt-2 text-xs muted">
                    {(item.size / 1024).toLocaleString(
                      locale === "zh" ? "zh-CN" : "en-GB",
                      { maximumFractionDigits: 1 },
                    )}{" "}
                    KB <span aria-hidden="true">·</span>{" "}
                    {formatDate(item.createdAt, locale)}
                  </p>
                </div>
                <div className="flex flex-wrap items-start gap-2 border-t border-[var(--border)] pt-3">
                  <button
                    className="button-secondary px-2 py-1.5 text-xs"
                    type="button"
                    onClick={() => void copy(item, false)}
                    aria-label={t(
                      `复制 ${item.filename} 的链接`,
                      `Copy URL for ${item.filename}`,
                    )}
                  >
                    {t("复制链接", "Copy URL")}
                  </button>
                  <button
                    className="button-secondary px-2 py-1.5 text-xs"
                    type="button"
                    onClick={() => void copy(item, true)}
                    aria-label={t(
                      `复制 ${item.filename} 的 Markdown`,
                      `Copy Markdown for ${item.filename}`,
                    )}
                  >
                    {t("复制 Markdown", "Copy Markdown")}
                  </button>
                  <div className="ml-auto">
                    <AdminDeleteButton
                      endpoint={`/api/images/${encodeURIComponent(item.id)}`}
                      title={item.filename}
                      kind="image"
                      onDeleted={() =>
                        setMessage(
                          t(
                            `已删除「${item.filename}」。`,
                            `“${item.filename}” deleted.`,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
