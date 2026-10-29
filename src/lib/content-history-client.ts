import {
  readApiObject,
  readTranslationDrafts,
  type TranslationDrafts,
} from "./editor.ts";

export type EditorFields = {
  translations: TranslationDrafts;
  slug: string;
  module: string;
  subjectSlug: string;
  chapterSlug: string;
  order: string;
  isPublic: boolean;
  isPublished: boolean;
};
export class HistoryRequestError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 0) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
export async function adminMutation(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body: unknown,
  fetcher: typeof fetch = fetch,
  adminUserId?: string,
): Promise<Record<string, unknown>> {
  try {
    const csrfResponse = await fetcher("/api/account/csrf", {
      cache: "no-store",
      credentials: "same-origin",
    });
    const csrf = await readApiObject(csrfResponse);
    if (!csrfResponse.ok || typeof csrf.csrfToken !== "string")
      throw new HistoryRequestError("UNAVAILABLE", csrfResponse.status);
    const headers = new Headers({
      "Content-Type": "application/json",
      "X-CSRF-Token": csrf.csrfToken,
    });
    if (adminUserId) headers.set("X-Admin-User", adminUserId);
    const response = await fetcher(path, {
      method,
      headers,
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(body),
    });
    const data = await readApiObject(response);
    if (!response.ok)
      throw new HistoryRequestError(
        typeof data.code === "string" ? data.code : "UNAVAILABLE",
        response.status,
      );
    return data;
  } catch (error) {
    if (error instanceof HistoryRequestError) throw error;
    throw new HistoryRequestError("UNAVAILABLE");
  }
}
export function restoreEditorFields(value: unknown): EditorFields | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    !input.translations ||
    typeof input.translations !== "object" ||
    Array.isArray(input.translations)
  )
    return null;
  const text = (key: string) =>
    typeof input[key] === "string" ? (input[key] as string) : "";
  return {
    translations: readTranslationDrafts("", "", input.translations),
    slug: text("slug"),
    module: text("module"),
    subjectSlug: text("subjectSlug"),
    chapterSlug: text("chapterSlug"),
    order: text("order") || "0",
    isPublic: input.isPublic !== false,
    isPublished: input.isPublished === true,
  };
}
export function historyErrorMessage(error: unknown, locale: "zh" | "en") {
  const messages: Record<string, [string, string]> = {
    VERSION_CONFLICT: [
      "文章已有其他修改。你的内容仍保留在编辑器；请复制后重新载入最新版本再合并。",
      "This article changed elsewhere. Your writing remains in the editor; copy it, reload the latest version, then merge your changes.",
    ],
    DRAFT_CONFLICT: [
      "另一个标签页修改了自动草稿。已停止覆盖；请保留此页内容，重新载入后选择恢复草稿。",
      "Another tab changed this automatic draft. Saving stopped to protect both copies. Keep your writing and reload to choose a recovery copy.",
    ],
    CONTENT_TRASHED: [
      "文章已移入回收站，请先恢复再编辑。",
      "This article is in the trash. Restore it before editing.",
    ],
    IMAGE_UNAVAILABLE: [
      "文章引用的图片已被删除或正在清理。编辑内容仍保留，请重新上传或替换该图片后保存。",
      "An image used by this article was removed or is being cleaned up. Your writing is kept. Upload or replace the image before saving.",
    ],
    CSRF_INVALID: [
      "页面安全验证已失效，请刷新后重试。当前编辑仍保留。",
      "The page security check expired. Refresh and retry; your writing remains here.",
    ],
    FORBIDDEN: [
      "当前会话没有管理员权限，请重新登录。",
      "This session does not have administrator access. Sign in again.",
    ],
    DRAFT_PENDING: [
      "请先选择恢复或丢弃检测到的自动草稿。",
      "Choose whether to recover or discard the automatic draft first.",
    ],
    SESSION_CHANGED: [
      "登录账户已变化，自动保存已停止。请复制此页编辑内容后重新打开编辑器。",
      "Your signed-in account changed. Automatic saving stopped. Copy your writing, then reopen the editor.",
    ],
    UNAVAILABLE: [
      "暂时无法保存。此页内容仍保留，可以复制备份后重试。",
      "Saving is unavailable. Your writing remains on this page; copy a backup and retry.",
    ],
  };
  const code =
    error instanceof HistoryRequestError ? error.code : "UNAVAILABLE";
  return (messages[code] ?? messages.UNAVAILABLE)[locale === "zh" ? 0 : 1];
}
