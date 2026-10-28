"use client";

import type { RefObject } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";
import type { EditorLocale, TranslationDrafts } from "@/lib/editor";

export type MarkdownPreview = {
  html: string;
  state: "empty" | "loading" | "ready" | "error";
  error: string;
};

type Props = {
  translations: TranslationDrafts;
  editingLocale: EditorLocale;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  uploading: boolean;
  dragging: boolean;
  preview: MarkdownPreview;
  onLanguageChange: (locale: EditorLocale) => void;
  onTranslationChange: (key: "title" | "body", value: string) => void;
  onDraggingChange: (dragging: boolean) => void;
  onUploadImage: (file: File) => Promise<void>;
};

export function BilingualWritingPane({
  translations,
  editingLocale,
  textareaRef,
  fileInputRef,
  uploading,
  dragging,
  preview,
  onLanguageChange,
  onTranslationChange,
  onDraggingChange,
  onUploadImage,
}: Props) {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  const active = translations[editingLocale];

  return (
    <section className="space-y-4" aria-labelledby="translation-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="translation-heading" className="section-heading">
            {t("内容与翻译", "Content & translations")}
          </h2>
          <p className="muted mt-1 text-sm">
            {t(
              "两种语言分别编辑，共用一个文章链接。发布前请补全已填写语言的标题与正文。",
              "Edit each language separately under one shared URL. Complete each started translation before publishing.",
            )}
          </p>
        </div>
        <div
          className="flex gap-1 rounded-md border border-[var(--border)] p-1"
          role="group"
          aria-label={t("编辑内容的语言", "Content language")}
        >
          {(["zh", "en"] as const).map((language) => (
            <button
              key={language}
              type="button"
              aria-pressed={editingLocale === language}
              onClick={() => {
                onLanguageChange(language);
              }}
              className={
                editingLocale === language
                  ? "button px-3 py-1.5"
                  : "button-ghost px-3 py-1.5"
              }
              lang={language === "zh" ? "zh-CN" : "en"}
            >
              {language === "zh" ? "中文" : "English"}
              <span className="sr-only">
                {translations[language].title && translations[language].body
                  ? t("，已有内容", ", content available")
                  : t("，待填写", ", empty")}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label
          className="mb-2 block text-sm font-semibold"
          htmlFor="article-title"
        >
          {editingLocale === "zh"
            ? t("中文标题", "Chinese title")
            : t("英文标题", "English title")}
        </label>
        <input
          id="article-title"
          maxLength={240}
          className="input w-full text-lg"
          value={active.title}
          onChange={(event) => onTranslationChange("title", event.target.value)}
          lang={editingLocale === "zh" ? "zh-CN" : "en"}
          placeholder={
            editingLocale === "zh"
              ? "例如：热力学第一定律"
              : "e.g. The first law of thermodynamics"
          }
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="article-body" className="text-sm font-semibold">
              {editingLocale === "zh"
                ? t("中文正文 · Markdown", "Chinese body · Markdown")
                : t("英文正文 · Markdown", "English body · Markdown")}
            </label>
            <button
              type="button"
              disabled={uploading}
              className="button-secondary px-3 py-1.5 text-xs"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading
                ? t("正在上传…", "Uploading…")
                : t("插入图片", "Insert image")}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            aria-label={t("选择要插入的图片", "Choose an image to insert")}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onUploadImage(file);
              event.currentTarget.value = "";
            }}
          />
          <div className="relative">
            <textarea
              id="article-body"
              maxLength={300000}
              ref={textareaRef}
              className="input min-h-[32rem] w-full resize-y font-mono text-sm leading-7"
              value={active.body}
              lang={editingLocale === "zh" ? "zh-CN" : "en"}
              aria-describedby="body-help"
              onChange={(event) =>
                onTranslationChange("body", event.target.value)
              }
              onDragOver={(event) => {
                event.preventDefault();
                onDraggingChange(true);
              }}
              onDragLeave={() => onDraggingChange(false)}
              onDrop={(event) => {
                event.preventDefault();
                onDraggingChange(false);
                const file = event.dataTransfer.files[0];
                if (file) void onUploadImage(file);
              }}
              onPaste={(event) => {
                const file = Array.from(event.clipboardData.items)
                  .find((item) => item.type.startsWith("image/"))
                  ?.getAsFile();
                if (file) {
                  event.preventDefault();
                  void onUploadImage(file);
                }
              }}
              placeholder={
                editingLocale === "zh"
                  ? "## 核心概念\n\n使用 Markdown 编写笔记。\n\n$$\\Delta U = q + w$$"
                  : "## Key concepts\n\nWrite your notes in Markdown.\n\n$$\\Delta U = q + w$$"
              }
            />
            {dragging && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-md border-2 border-dashed border-[var(--accent)] bg-[var(--surface)] p-6 text-center font-semibold">
                {t("松开以插入图片", "Drop to insert image")}
              </div>
            )}
          </div>
          <p id="body-help" className="text-xs leading-5 muted">
            {t(
              "支持 Markdown、LaTeX 公式、拖放图片与粘贴截图。PNG、JPG 或 WebP，每张不超过 4 MiB。上传后的图片链接可公开分享。",
              "Markdown, LaTeX, image drops, and pasted screenshots. PNG, JPG, or WebP; up to 4 MiB each. Uploaded image links can be shared publicly.",
            )}
          </p>
        </div>
        <div className="min-w-0 space-y-2">
          <h3 className="flex min-h-9 items-center text-sm font-semibold">
            {t("阅读预览", "Reading preview")}
          </h3>
          <div
            className="min-h-[32rem] overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--surface)] p-5"
            aria-busy={preview.state === "loading"}
          >
            {preview.state === "error" ? (
              <p className="notice notice-error" role="alert">
                {preview.error}
              </p>
            ) : preview.state === "ready" ? (
              <article
                className="prose max-w-none"
                lang={editingLocale === "zh" ? "zh-CN" : "en"}
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            ) : (
              <p className="muted text-sm" role="status">
                {preview.state === "loading"
                  ? t("正在更新预览…", "Updating preview…")
                  : t(
                      "输入正文后，预览会显示在这里。",
                      "Your reading preview will appear here as you write.",
                    )}
              </p>
            )}
          </div>
          <p className="text-xs leading-5 muted">
            {t(
              "预览支持公式和表格。JavaScript 与交互式 MDX 组件不会运行。",
              "Preview supports equations and tables. JavaScript and interactive MDX components do not run.",
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
