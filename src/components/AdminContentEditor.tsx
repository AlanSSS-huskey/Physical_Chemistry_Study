"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { BilingualWritingPane } from "@/components/admin/BilingualWritingPane";
import {
  ArticleMetadataFields,
  type ArticleMetadataValues,
} from "@/components/admin/ArticleMetadataFields";
import { textFor } from "@/lib/i18n";
import uploadLimits from "@/lib/upload-limits.json";
import {
  adminErrorMessage,
  canonicalTranslation,
  readApiObject,
  imageMarkdown,
  insertText,
  readTranslationDrafts,
  suggestSlug,
  validateDraft,
  type EditorLocale,
} from "@/lib/editor";
import {
  adminMutation,
  historyErrorMessage,
  HistoryRequestError,
  type EditorFields,
} from "@/lib/content-history-client";
import { usePrivateDraft } from "@/components/admin/usePrivateDraft";
import { AutomaticDraftStatus } from "@/components/admin/AutomaticDraftStatus";
import { ContentHistoryPanel } from "@/components/admin/ContentHistoryPanel";
import "@/components/admin/admin-recovery.css";
import { BEFORE_STATE_NAVIGATION } from "@/lib/navigation-guard";

type Props = {
  adminUserId: string;
  contentId?: string;
  initialTitle?: string;
  initialSlug?: string;
  initialModule?: string;
  initialBody?: string;
  initialTranslations?: unknown;
  initialIsPublic?: boolean;
  initialIsPublished?: boolean;
  initialSubjectSlug?: string;
  initialChapterSlug?: string;
  initialOrder?: number;
  initialVersion?: number;
  moduleOptions?: string[];
};

function useUnsavedWork(isDirty: boolean, message: string) {
  useEffect(() => {
    if (!isDirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onNavigate = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (
        !link ||
        link.hasAttribute("download") ||
        (link.target && link.target !== "_self")
      )
        return;
      const target = new URL(link.href, window.location.href);
      if (
        target.pathname === window.location.pathname &&
        target.search === window.location.search
      )
        return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const confirmStateChange = (event: Event) => {
      if (!event.defaultPrevented && !window.confirm(message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener(BEFORE_STATE_NAVIGATION, confirmStateChange);
    document.addEventListener("click", onNavigate, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener(BEFORE_STATE_NAVIGATION, confirmStateChange);
      document.removeEventListener("click", onNavigate, true);
    };
  }, [isDirty, message]);
}

function useMarkdownPreview(source: string, locale: EditorLocale) {
  const [html, setHtml] = useState("");
  const [state, setState] = useState<"empty" | "loading" | "ready" | "error">(
    "empty",
  );
  const [error, setError] = useState("");
  const sequence = useRef(0);
  useEffect(() => {
    const current = ++sequence.current;
    const controller = new AbortController();
    setHtml("");
    setError("");
    if (!source.trim()) {
      setState("empty");
      return;
    }
    setState("loading");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/admin/preview-mdx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source }),
          signal: controller.signal,
        });
        const data = await readApiObject(response);
        if (controller.signal.aborted || current !== sequence.current) return;
        if (!response.ok || typeof data.html !== "string") {
          setError(
            adminErrorMessage(
              typeof data.code === "string" ? data.code : undefined,
              response.status,
              locale,
            ),
          );
          setState("error");
          return;
        }
        setHtml(data.html);
        setState("ready");
      } catch {
        if (!controller.signal.aborted && current === sequence.current) {
          setError(adminErrorMessage("UNAVAILABLE", 0, locale));
          setState("error");
        }
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [source, locale]);
  return { html, state, error };
}

export function AdminContentEditor({
  adminUserId,
  contentId,
  initialTitle = "",
  initialSlug = "",
  initialModule = "",
  initialBody = "",
  initialTranslations,
  initialIsPublic = true,
  initialIsPublished = false,
  initialSubjectSlug = "",
  initialChapterSlug = "",
  initialOrder = 0,
  initialVersion = 1,
  moduleOptions = [],
}: Props) {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  const router = useRouter();
  const [fields, setFields] = useState<EditorFields>(() => ({
    translations: readTranslationDrafts(
      initialTitle,
      initialBody,
      initialTranslations,
    ),
    slug: initialSlug,
    module: initialModule,
    subjectSlug: initialSubjectSlug,
    chapterSlug: initialChapterSlug,
    order: String(initialOrder),
    isPublic: initialIsPublic,
    isPublished: initialIsPublished,
  }));
  const [baseline, setBaseline] = useState(() => JSON.stringify(fields));
  const [editingLocale, setEditingLocale] = useState<EditorLocale>(() =>
    fields.translations[locale].title
      ? locale
      : fields.translations[locale === "zh" ? "en" : "zh"].title
        ? locale === "zh"
          ? "en"
          : "zh"
        : locale,
  );
  const [manualSlug, setManualSlug] = useState(Boolean(initialSlug));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [version, setVersion] = useState(initialVersion);
  const fieldsRef = useRef(fields);
  const editingLocaleRef = useRef(editingLocale);
  const savingRef = useRef(false);
  const uploadRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  fieldsRef.current = fields;
  editingLocaleRef.current = editingLocale;
  const active = fields.translations[editingLocale];
  const preview = useMarkdownPreview(active.body, locale);
  const isDirty = JSON.stringify(fields) !== baseline;
  const draft = usePrivateDraft(
    contentId,
    version,
    fields,
    isDirty,
    (recovered) => {
      fieldsRef.current = recovered;
      setFields(recovered);
      setManualSlug(Boolean(recovered.slug));
      setSaved(false);
    },
    adminUserId,
  );
  useUnsavedWork(
    isDirty,
    t(
      "有尚未保存的修改。确定离开编辑器吗？",
      "You have unsaved changes. Leave the editor?",
    ),
  );

  function changeFields(update: (previous: EditorFields) => EditorFields) {
    const next = update(fieldsRef.current);
    fieldsRef.current = next;
    setFields(next);
    setSaved(false);
  }

  function updateField<K extends keyof ArticleMetadataValues>(
    key: K,
    value: ArticleMetadataValues[K],
  ) {
    changeFields((previous) => ({ ...previous, [key]: value }));
  }

  function updateTranslation(key: "title" | "body", value: string) {
    changeFields((previous) => {
      const translations = {
        ...previous.translations,
        [editingLocale]: {
          ...previous.translations[editingLocale],
          [key]: value,
        },
      };
      return {
        ...previous,
        translations,
        slug:
          key === "title" && !manualSlug
            ? suggestSlug(translations.en.title || translations.zh.title)
            : previous.slug,
      };
    });
    setSaved(false);
  }

  async function uploadImage(file: File) {
    if (uploadRef.current || savingRef.current) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError(
        t(
          "请选择 PNG、JPG 或 WebP 图片。",
          "Choose a PNG, JPG, or WebP image.",
        ),
      );
      return;
    }
    if (file.size > uploadLimits.maxImageBytes) {
      setError(t("图片不能超过 4 MiB。", "Images must be 4 MiB or smaller."));
      return;
    }
    const targetLocale = editingLocaleRef.current;
    const formData = new FormData();
    formData.append("file", file);
    uploadRef.current = true;
    setUploading(true);
    setError("");
    try {
      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
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
      const latestBody = fieldsRef.current.translations[targetLocale].body;
      const textarea =
        editingLocaleRef.current === targetLocale ? textareaRef.current : null;
      const insertion = insertText(
        latestBody,
        imageMarkdown(file.name || t("图片", "Image"), data.url),
        textarea?.selectionStart ?? latestBody.length,
        textarea?.selectionEnd ?? latestBody.length,
      );
      changeFields((previous) => ({
        ...previous,
        translations: {
          ...previous.translations,
          [targetLocale]: {
            ...previous.translations[targetLocale],
            body: insertion.body,
          },
        },
      }));
      setSaved(false);
      if (textarea)
        requestAnimationFrame(() => {
          textarea.focus();
          textarea.setSelectionRange(insertion.cursor, insertion.cursor);
        });
    } catch {
      setError(adminErrorMessage("UNAVAILABLE", 0, locale));
    } finally {
      uploadRef.current = false;
      setUploading(false);
      setDragging(false);
    }
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || uploadRef.current) return;
    const validation = validateDraft(fields);
    if (validation) {
      if (validation.locale) setEditingLocale(validation.locale);
      const messages = {
        TITLE_REQUIRED: t(
          "请填写至少一种语言的标题和正文。",
          "Add a title and body in at least one language.",
        ),
        INCOMPLETE_TRANSLATION: t(
          "每种已填写的语言都需要同时有标题和正文。",
          "Each translation needs both a title and body. Leave both empty if it is not ready.",
        ),
        BODY_REQUIRED: t("发布前请填写正文。", "Add a body before publishing."),
        INVALID_SLUG: t(
          "链接标识仅支持小写英文字母、数字、连字符和分隔路径的斜杠。",
          "Use lowercase letters, numbers, and hyphens for the slug; slashes may separate path segments.",
        ),
        INVALID_PLACEMENT: t(
          "学科与章节标识仅支持小写英文字母、数字和连字符。",
          "Subject and chapter slugs may contain lowercase letters, numbers, and hyphens.",
        ),
        INVALID_ORDER: t(
          "排序必须是 0 到 100000 之间的整数。",
          "Order must be a whole number from 0 to 100000.",
        ),
      };
      setError(messages[validation.code]);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const draftIdentity = await draft.beginSave();
      const canonical = canonicalTranslation(fields.translations);
      const data = await adminMutation(
        contentId
          ? `/api/admin/content/${encodeURIComponent(contentId)}`
          : "/api/admin/content",
        contentId ? "PUT" : "POST",
        {
          ...fields,
          ...draftIdentity,
          ...(contentId ? { expectedVersion: version } : {}),
          title: canonical.title.trim(),
          body: canonical.body,
          slug: fields.slug.trim(),
          subjectSlug:
            fields.subjectSlug.trim() ||
            (fields.slug.includes("/") ? fields.slug.split("/")[0] : "notes"),
          chapterSlug:
            fields.chapterSlug.trim() || fields.slug.split("/").at(-1),
          order: Number(fields.order),
        },
      );
      if (
        typeof data.id !== "string" ||
        !data.id ||
        typeof data.version !== "number"
      )
        throw new HistoryRequestError("UNAVAILABLE");
      setVersion(data.version);
      draft.completeSave();
      setBaseline(JSON.stringify(fields));
      setSaved(true);
      if (!contentId)
        router.replace(`/admin/edit/${encodeURIComponent(data.id)}?saved=1`);
      router.refresh();
    } catch (failure) {
      setError(
        failure instanceof HistoryRequestError &&
          ["VALIDATION_ERROR", "BUNDLED_SLUG", "CONFLICT"].includes(
            failure.code,
          )
          ? adminErrorMessage(failure.code, failure.status, locale)
          : historyErrorMessage(failure, locale),
      );
    } finally {
      draft.finishSave();
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <>
      <form onSubmit={onSave} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge">
              {fields.isPublished
                ? t("已发布", "Published")
                : t("草稿", "Draft")}
            </span>
            <span className="text-xs muted" role="status">
              {isDirty
                ? t("有未保存的修改", "Unsaved changes")
                : contentId || saved
                  ? t("所有修改已保存", "All changes saved")
                  : t("新草稿", "New draft")}
            </span>
          </div>
          <button
            type="submit"
            disabled={saving || uploading || !draft.ready}
            className="button"
          >
            {saving ? t("正在保存…", "Saving…") : t("保存文章", "Save article")}
          </button>
        </div>
        <AutomaticDraftStatus draft={draft} version={version} />
        {error && (
          <div className="notice notice-error" role="alert">
            {error}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold">
                {t("复制编辑内容备份", "Copy a backup of your writing")}
              </summary>
              <label className="mt-2 block text-xs">
                {t(
                  "以下包括两种语言与设置。选中后复制保存。",
                  "This includes both languages and settings. Select and copy it to keep a backup.",
                )}
                <textarea
                  className="input mt-2 min-h-40 w-full font-mono text-xs"
                  readOnly
                  value={JSON.stringify(fields, null, 2)}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </label>
            </details>
          </div>
        )}
        {saved && (
          <div className="notice" role="status">
            {t("文章已保存。", "Article saved.")}
          </div>
        )}
        {uploading && (
          <div className="notice" role="status">
            {t(
              "正在上传图片，可以继续编辑正文…",
              "Uploading image. You can keep editing…",
            )}
          </div>
        )}
        <fieldset disabled={saving} className="min-w-0 space-y-6">
          <legend className="sr-only">
            {t("文章编辑器", "Article editor")}
          </legend>
          <BilingualWritingPane
            translations={fields.translations}
            editingLocale={editingLocale}
            textareaRef={textareaRef}
            fileInputRef={fileInputRef}
            uploading={uploading}
            dragging={dragging}
            preview={preview}
            onLanguageChange={(language) => {
              setEditingLocale(language);
              setError("");
            }}
            onTranslationChange={updateTranslation}
            onDraggingChange={setDragging}
            onUploadImage={uploadImage}
          />
          <ArticleMetadataFields
            fields={fields}
            moduleOptions={moduleOptions}
            canRegenerateSlug={manualSlug && !contentId}
            onSlugChange={(value) => {
              setManualSlug(true);
              updateField("slug", value);
            }}
            onRegenerateSlug={() => {
              setManualSlug(false);
              updateField(
                "slug",
                suggestSlug(
                  fields.translations.en.title || fields.translations.zh.title,
                ),
              );
            }}
            onFieldChange={updateField}
          />
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
          <p className="text-xs muted" role="status">
            {saving
              ? t("正在保存文章…", "Saving article…")
              : isDirty
                ? t("离开前请保存修改。", "Save your changes before leaving.")
                : contentId || saved
                  ? t("已与服务器同步。", "Up to date with the server.")
                  : t(
                      "填写标题后即可保存草稿。",
                      "Add a title to save your draft.",
                    )}
          </p>
          <button
            type="submit"
            disabled={saving || uploading || !draft.ready}
            className="button"
          >
            {saving ? t("正在保存…", "Saving…") : t("保存文章", "Save article")}
          </button>
        </div>
      </form>
      {contentId && (
        <ContentHistoryPanel
          contentId={contentId}
          version={version}
          hasUnsavedChanges={isDirty}
        />
      )}
    </>
  );
}
