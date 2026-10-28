export type EditorLocale = "zh" | "en";
export type TranslationDraft = {
  title: string;
  body: string;
  subjectTitle?: string;
};
export type TranslationDrafts = Record<EditorLocale, TranslationDraft>;

export function suggestSlug(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .split("/")
    .map((part) => part.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean)
    .join("/");
}

export function noteHref(slug: string): string {
  return `/notes/${slug.split("/").map(encodeURIComponent).join("/")}`;
}

export function readTranslationDrafts(
  title: string,
  body: string,
  value: unknown,
): TranslationDrafts {
  const result: TranslationDrafts = {
    zh: { title: "", body: "" },
    en: { title: "", body: "" },
  };
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : null;
  let hasTranslation = false;
  for (const locale of ["zh", "en"] as const) {
    const entry = source?.[locale];
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      result[locale] = {
        title: typeof record.title === "string" ? record.title : "",
        body: typeof record.body === "string" ? record.body : "",
        ...(typeof record.subjectTitle === "string"
          ? { subjectTitle: record.subjectTitle }
          : {}),
      };
      hasTranslation = true;
    }
  }
  if (!hasTranslation)
    result[/[\u3400-\u9fff]/u.test(`${title} ${body}`) ? "zh" : "en"] = {
      title,
      body,
    };
  return result;
}

export type DraftValidation = {
  code:
    | "TITLE_REQUIRED"
    | "INCOMPLETE_TRANSLATION"
    | "BODY_REQUIRED"
    | "INVALID_SLUG"
    | "INVALID_PLACEMENT"
    | "INVALID_ORDER";
  locale?: EditorLocale;
};
export function validateDraft(draft: {
  translations: TranslationDrafts;
  slug: string;
  subjectSlug: string;
  chapterSlug: string;
  order: string;
  isPublished: boolean;
}): DraftValidation | null {
  const locales = ["zh", "en"] as const;
  if (!locales.some((locale) => draft.translations[locale].title.trim()))
    return { code: "TITLE_REQUIRED" };
  for (const locale of locales) {
    const { title, body } = draft.translations[locale];
    if (draft.isPublished && Boolean(title.trim()) !== Boolean(body.trim()))
      return { code: "INCOMPLETE_TRANSLATION", locale };
  }
  if (
    draft.isPublished &&
    !locales.some((locale) => draft.translations[locale].body.trim())
  )
    return { code: "BODY_REQUIRED" };
  if (!/^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/.test(draft.slug.trim()))
    return { code: "INVALID_SLUG" };
  if (
    [draft.subjectSlug, draft.chapterSlug].some(
      (value) => value.trim() && !/^[a-z0-9][a-z0-9-]*$/.test(value.trim()),
    )
  )
    return { code: "INVALID_PLACEMENT" };
  if (
    !/^\d+$/.test(draft.order) ||
    !Number.isSafeInteger(Number(draft.order)) ||
    Number(draft.order) > 100_000
  )
    return { code: "INVALID_ORDER" };
  return null;
}

export function insertText(
  body: string,
  text: string,
  start: number,
  end: number,
): { body: string; cursor: number } {
  const from = Math.max(0, Math.min(start, body.length));
  const to = Math.max(from, Math.min(end, body.length));
  return {
    body: `${body.slice(0, from)}${text}${body.slice(to)}`,
    cursor: from + text.length,
  };
}

export function imageMarkdown(name: string, url: string): string {
  const alt = name
    .replace(/\\/g, "\\\\")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/[\r\n]/g, " ");
  const destination = url
    .replace(/\s/g, (character) => encodeURIComponent(character))
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
  return `\n![${alt}](${destination})\n`;
}

export function adminErrorMessage(
  code: string | undefined,
  status: number,
  locale: EditorLocale,
): string {
  const messages: Record<string, [string, string]> = {
    FORBIDDEN: [
      "当前会话没有管理员权限。请重新登录后再试，编辑内容仍保留在此页面。",
      "This session does not have administrator access. Sign in again and retry; your edits remain on this page.",
    ],
    UNAVAILABLE: [
      "内容服务暂时不可用。请稍后重试，编辑内容仍保留在此页面。",
      "The content service is temporarily unavailable. Retry later; your edits remain on this page.",
    ],
    STORAGE_UNAVAILABLE: [
      "图片存储暂时不可用，请稍后重试。",
      "Image storage is temporarily unavailable. Please retry later.",
    ],
    BUNDLED_SLUG: [
      "内置文章必须保留原有链接标识。请恢复原链接标识后保存；如需使用新链接，请另行新建一篇文章。",
      "Keep the original slug for this bundled article. Restore it and save; create a separate note if you need a new URL.",
    ],
    BUNDLED_CONTENT: [
      "此文章包含网站内置原稿，不能直接删除。请打开编辑器，取消勾选「发布文章」并保存，以停止展示此文章。",
      "This article has a bundled original and cannot be deleted directly. Open the editor, uncheck “Publish article”, and save to remove it from the reading library.",
    ],
    CONFLICT: [
      "此链接标识已被使用。请修改链接标识后保存。",
      "This slug is already in use. Choose another slug and save again.",
    ],
    NOT_FOUND: [
      "此内容已不存在，请刷新列表。",
      "This item no longer exists. Refresh the list.",
    ],
    VALIDATION_ERROR: [
      "请检查字段内容、翻译完整性和链接标识后重试。",
      "Check the fields, translation pairs, and slug, then retry.",
    ],
  };
  const effectiveCode =
    code && messages[code]
      ? code
      : status === 401 || status === 403
        ? "FORBIDDEN"
        : status === 409
          ? "CONFLICT"
          : status >= 500 || status === 0 || (status >= 200 && status < 300)
            ? "UNAVAILABLE"
            : status === 404
              ? "NOT_FOUND"
              : "VALIDATION_ERROR";
  return messages[effectiveCode][locale === "zh" ? 0 : 1];
}

export async function readApiObject(
  response: Response,
): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await response.json();
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function canonicalTranslation(
  translations: TranslationDrafts,
): TranslationDraft {
  return (
    [translations.zh, translations.en].find(
      (entry) => entry.title.trim() && entry.body.trim(),
    ) ??
    [translations.zh, translations.en].find((entry) => entry.title.trim()) ??
    translations.zh
  );
}
