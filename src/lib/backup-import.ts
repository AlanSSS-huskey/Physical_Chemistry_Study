import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { AccountError, accountSecret } from "./account-security.ts";

export const MAX_BACKUP_BYTES = 1024 * 1024;
const PREVIEW_LIFETIME = 10 * 60 * 1000;
type Input = Record<string, unknown>;
type ImportNote = { contentSlug: string; locale: "zh" | "en"; body: string };
type NormalizedBackup = {
  sourceAccountId: string | null;
  notes: ImportNote[];
  bookmarks: { contentSlug: string }[];
};
type Snapshot = {
  notes: {
    id: string;
    contentSlug: string;
    locale: string;
    body: string;
    revision: number;
    updatedAt: Date;
  }[];
  bookmarks: { id: string; contentSlug: string; createdAt: Date }[];
};
type PreviewProof = {
  version: 1;
  userId: string;
  fileHash: string;
  snapshotHash: string;
  expiresAt: number;
};
function invalid(): never {
  throw new AccountError("BACKUP_INVALID", 400);
}
function object(value: unknown): value is Input {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function slug(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 240 ||
    !/^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/.test(value)
  )
    invalid();
  return value;
}
function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function identity(note: Pick<ImportNote, "contentSlug" | "locale">) {
  return `${note.contentSlug}:${note.locale}`;
}
/** Ignore account/permission/progress fields; they are never an import authority. */
export function normalizeBackup(value: unknown): NormalizedBackup {
  if (
    !object(value) ||
    value.format !== "physical-chemistry-account" ||
    value.version !== 1 ||
    !Array.isArray(value.notes) ||
    !Array.isArray(value.bookmarks)
  )
    invalid();
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_BACKUP_BYTES)
    throw new AccountError("BACKUP_TOO_LARGE", 413);
  if (value.notes.length > 100 || value.bookmarks.length > 500) invalid();
  const noteKeys = new Set<string>();
  const bookmarkKeys = new Set<string>();
  const notes = value.notes
    .map((entry): ImportNote => {
      if (
        !object(entry) ||
        (entry.locale !== "zh" && entry.locale !== "en") ||
        typeof entry.body !== "string" ||
        entry.body.length > 5000 ||
        /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(entry.body)
      )
        invalid();
      const note: ImportNote = {
        contentSlug: slug(entry.contentSlug),
        locale: entry.locale,
        body: entry.body,
      };
      const key = identity(note);
      if (noteKeys.has(key)) invalid();
      noteKeys.add(key);
      return note;
    })
    .sort((left, right) => identity(left).localeCompare(identity(right), "en"));
  const bookmarks = value.bookmarks
    .map((entry) => {
      if (!object(entry)) invalid();
      const contentSlug = slug(entry.contentSlug);
      if (bookmarkKeys.has(contentSlug)) invalid();
      bookmarkKeys.add(contentSlug);
      return { contentSlug };
    })
    .sort((left, right) =>
      left.contentSlug.localeCompare(right.contentSlug, "en"),
    );
  const sourceAccountId =
    object(value.profile) &&
    typeof value.profile.id === "string" &&
    value.profile.id.length <= 100
      ? value.profile.id
      : null;
  return { sourceAccountId, notes, bookmarks };
}
function signature(payload: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`chemistry-backup-import-v1:${payload}`)
    .digest("base64url");
}
function sign(proof: PreviewProof, secret: string) {
  const payload = Buffer.from(JSON.stringify(proof)).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}
function readProof(
  token: unknown,
  userId: string,
  fileHash: string,
  now: number,
  secret: string,
): PreviewProof {
  if (typeof token !== "string" || token.length > 2048)
    throw new AccountError("PREVIEW_INVALID", 409);
  const [payload, signed, extra] = token.split(".");
  if (
    extra ||
    !/^[A-Za-z0-9_-]+$/.test(payload || "") ||
    !/^[A-Za-z0-9_-]{43}$/.test(signed || "")
  )
    throw new AccountError("PREVIEW_INVALID", 409);
  const expected = signature(payload, secret);
  if (!timingSafeEqual(Buffer.from(signed), Buffer.from(expected)))
    throw new AccountError("PREVIEW_INVALID", 409);
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new AccountError("PREVIEW_INVALID", 409);
  }
  if (
    !object(parsed) ||
    parsed.version !== 1 ||
    parsed.userId !== userId ||
    parsed.fileHash !== fileHash ||
    typeof parsed.snapshotHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(parsed.snapshotHash) ||
    !Number.isSafeInteger(parsed.expiresAt)
  )
    throw new AccountError("PREVIEW_INVALID", 409);
  if (Number(parsed.expiresAt) <= now)
    throw new AccountError("PREVIEW_EXPIRED", 409);
  if (Number(parsed.expiresAt) > now + PREVIEW_LIFETIME)
    throw new AccountError("PREVIEW_INVALID", 409);
  return parsed as PreviewProof;
}
async function snapshot(
  tx: Prisma.TransactionClient,
  userId: string,
  backup: NormalizedBackup,
): Promise<Snapshot> {
  const [notes, bookmarks] = await Promise.all([
    backup.notes.length
      ? tx.personalNote.findMany({
          where: {
            userId,
            OR: backup.notes.map(({ contentSlug, locale }) => ({
              contentSlug,
              locale,
            })),
          },
          select: {
            id: true,
            contentSlug: true,
            locale: true,
            body: true,
            revision: true,
            updatedAt: true,
          },
        })
      : [],
    backup.bookmarks.length
      ? tx.bookmark.findMany({
          where: {
            userId,
            contentSlug: {
              in: backup.bookmarks.map((item) => item.contentSlug),
            },
          },
          select: { id: true, contentSlug: true, createdAt: true },
        })
      : [],
  ]);
  notes.sort((left, right) =>
    identity(left as ImportNote).localeCompare(
      identity(right as ImportNote),
      "en",
    ),
  );
  bookmarks.sort((left, right) =>
    left.contentSlug.localeCompare(right.contentSlug, "en"),
  );
  return { notes, bookmarks };
}
function previewRows(backup: NormalizedBackup, current: Snapshot) {
  const byIdentity = new Map(
    current.notes.map((note) => [identity(note as ImportNote), note]),
  );
  return backup.notes.map((note) => {
    const existing = byIdentity.get(identity(note));
    return {
      slug: note.contentSlug,
      locale: note.locale,
      incomingBody: note.body,
      currentBody: existing?.body ?? null,
      currentRevision: existing?.revision ?? null,
      status: !existing
        ? ("new" as const)
        : existing.body === note.body
          ? ("identical" as const)
          : ("conflict" as const),
    };
  });
}
function databaseConflict(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    ["P2034", "P2002"].includes(String(error.code)),
  );
}
export function createBackupImportService(options: {
  db: PrismaClient;
  now?: () => number;
  secret?: () => string;
}) {
  const db = options.db;
  const now = options.now || Date.now;
  const secret = options.secret || accountSecret;
  async function rate(userId: string, action: "preview" | "apply") {
    const bucket = Math.floor(now() / 3600000);
    const expiresAt = new Date((bucket + 1) * 3600000);
    const key = createHmac("sha256", secret())
      .update(`backup-import-rate:${action}:${userId}:${bucket}`)
      .digest("hex");
    const record = await db.authRateLimit.upsert({
      where: { key },
      create: { key, count: 1, expiresAt },
      update: { count: { increment: 1 } },
    });
    if (record.count > (action === "preview" ? 20 : 5))
      throw new AccountError(
        "RATE_LIMITED",
        429,
        Math.max(1, Math.ceil((expiresAt.getTime() - now()) / 1000)),
      );
  }
  async function transaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await db.$transaction(operation, {
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 15000,
      });
    } catch (error) {
      if (databaseConflict(error)) throw new AccountError("PREVIEW_STALE", 409);
      throw error;
    }
  }
  return {
    async preview(userId: string, input: Input) {
      await rate(userId, "preview");
      const backup = normalizeBackup(input.backup);
      const current = await transaction((tx) => snapshot(tx, userId, backup));
      const expiresAt = now() + PREVIEW_LIFETIME;
      const bookmarked = new Set(
        current.bookmarks.map((item) => item.contentSlug),
      );
      const existingCount = backup.bookmarks.filter((item) =>
        bookmarked.has(item.contentSlug),
      ).length;
      return {
        previewToken: sign(
          {
            version: 1,
            userId,
            fileHash: digest(backup),
            snapshotHash: digest(current),
            expiresAt,
          },
          secret(),
        ),
        notes: previewRows(backup, current),
        bookmarks: {
          newCount: backup.bookmarks.length - existingCount,
          existingCount,
        },
        sourceAccountDifferent: Boolean(
          backup.sourceAccountId && backup.sourceAccountId !== userId,
        ),
        expiresAt: new Date(expiresAt).toISOString(),
      };
    },
    async apply(userId: string, input: Input) {
      await rate(userId, "apply");
      if (input.confirm !== true)
        throw new AccountError("CONFIRMATION_REQUIRED", 400);
      if (
        input.conflictMode !== undefined &&
        input.conflictMode !== "keep-existing" &&
        input.conflictMode !== "replace-conflicts"
      )
        invalid();
      const backup = normalizeBackup(input.backup);
      const proof = readProof(
        input.previewToken,
        userId,
        digest(backup),
        now(),
        secret(),
      );
      return transaction(async (tx) => {
        const current = await snapshot(tx, userId, backup);
        if (now() >= proof.expiresAt)
          throw new AccountError("PREVIEW_EXPIRED", 409);
        if (digest(current) !== proof.snapshotHash)
          throw new AccountError("PREVIEW_STALE", 409);
        const rows = previewRows(backup, current);
        const newNotes = rows.filter((note) => note.status === "new");
        const conflicts =
          input.conflictMode === "replace-conflicts"
            ? rows.filter((note) => note.status === "conflict")
            : [];
        const created = newNotes.length
          ? await tx.personalNote.createMany({
              data: newNotes.map((note) => ({
                userId,
                contentSlug: note.slug,
                locale: note.locale,
                body: note.incomingBody,
                revision: 1,
              })),
            })
          : { count: 0 };
        if (created.count !== newNotes.length)
          throw new AccountError("PREVIEW_STALE", 409);
        let notesUpdated = 0;
        if (conflicts.length) {
          const values = conflicts.map(
            (note) =>
              Prisma.sql`(${note.slug}, ${note.locale}, ${note.currentRevision}::integer, ${note.currentBody}, ${note.incomingBody})`,
          );
          notesUpdated = await tx.$executeRaw(Prisma.sql`
            UPDATE "PersonalNote" AS destination
            SET "body" = incoming.body, "revision" = destination."revision" + 1, "updatedAt" = CURRENT_TIMESTAMP
            FROM (VALUES ${Prisma.join(values)}) AS incoming(slug, locale, revision, previous_body, body)
            WHERE destination."userId" = ${userId}
              AND destination."contentSlug" = incoming.slug AND destination."locale" = incoming.locale
              AND destination."revision" = incoming.revision AND destination."body" = incoming.previous_body
          `);
          if (notesUpdated !== conflicts.length)
            throw new AccountError("PREVIEW_STALE", 409);
        }
        const existingBookmarks = new Set(
          current.bookmarks.map((item) => item.contentSlug),
        );
        const newBookmarks = backup.bookmarks.filter(
          (item) => !existingBookmarks.has(item.contentSlug),
        );
        const added = newBookmarks.length
          ? await tx.bookmark.createMany({
              data: newBookmarks.map((item) => ({
                userId,
                contentSlug: item.contentSlug,
              })),
              skipDuplicates: true,
            })
          : { count: 0 };
        if (added.count !== newBookmarks.length)
          throw new AccountError("PREVIEW_STALE", 409);
        return {
          notesCreated: created.count,
          notesUpdated,
          notesSkipped: rows.length - created.count - notesUpdated,
          bookmarksAdded: added.count,
        };
      });
    },
  };
}
