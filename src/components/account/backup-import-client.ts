export class BackupImportProblem extends Error {
  readonly code: "BACKUP_INVALID" | "BACKUP_TOO_LARGE";
  constructor(code: "BACKUP_INVALID" | "BACKUP_TOO_LARGE") {
    super(code);
    this.code = code;
  }
}
export type BackupPreviewNote = {
  slug: string;
  locale: "zh" | "en";
  incomingBody: string;
  currentBody: string | null;
  currentRevision: number | null;
  status: "new" | "identical" | "conflict";
};
export type BackupPreview = {
  previewToken: string;
  notes: BackupPreviewNote[];
  bookmarks: { newCount: number; existingCount: number };
  sourceAccountDifferent: boolean;
  expiresAt: string;
};
export type BackupApplyResult = {
  notesCreated: number;
  notesUpdated: number;
  notesSkipped: number;
  bookmarksAdded: number;
};
export const BACKUP_MAX_BYTES = 1024 * 1024;
function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function slug(value: unknown) {
  return (
    typeof value === "string" &&
    value.length <= 240 &&
    /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/.test(value)
  );
}
/** This rejects obvious mistakes locally; the server remains the authority for every write. */
export function parseBackupImport(raw: string): Record<string, unknown> {
  if (new TextEncoder().encode(raw).byteLength > BACKUP_MAX_BYTES)
    throw new BackupImportProblem("BACKUP_TOO_LARGE");
  let value: unknown;
  try {
    value = JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch {
    throw new BackupImportProblem("BACKUP_INVALID");
  }
  if (
    !object(value) ||
    value.format !== "physical-chemistry-account" ||
    value.version !== 1 ||
    !Array.isArray(value.notes) ||
    value.notes.length > 100 ||
    !Array.isArray(value.bookmarks) ||
    value.bookmarks.length > 500
  )
    throw new BackupImportProblem("BACKUP_INVALID");
  for (const note of value.notes)
    if (
      !object(note) ||
      !slug(note.contentSlug) ||
      !["zh", "en"].includes(String(note.locale)) ||
      typeof note.body !== "string" ||
      note.body.length > 5000
    )
      throw new BackupImportProblem("BACKUP_INVALID");
  for (const bookmark of value.bookmarks)
    if (!object(bookmark) || !slug(bookmark.contentSlug))
      throw new BackupImportProblem("BACKUP_INVALID");
  return value;
}
export function summarizeBackupPreview(
  preview: Pick<BackupPreview, "notes" | "bookmarks">,
) {
  return {
    notesNew: preview.notes.filter((note) => note.status === "new").length,
    notesIdentical: preview.notes.filter((note) => note.status === "identical")
      .length,
    notesConflicting: preview.notes.filter((note) => note.status === "conflict")
      .length,
    bookmarksNew: preview.bookmarks.newCount,
    bookmarksExisting: preview.bookmarks.existingCount,
  };
}
export function previewNeedsRefresh(code: string) {
  return [
    "PREVIEW_INVALID",
    "PREVIEW_EXPIRED",
    "PREVIEW_STALE",
    "IMPORT_STALE",
  ].includes(code);
}
