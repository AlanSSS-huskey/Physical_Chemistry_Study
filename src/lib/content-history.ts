import { Prisma, type Content } from "@prisma/client";
import {
  validateContentInput,
  type ContentInput,
} from "./content-validation.ts";

export class ContentHistoryError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.name = "ContentHistoryError";
    this.code = code;
    this.status = status;
  }
}

export type ContentActor = { id: string; isAdmin: boolean } | null;
type Tx = Pick<
  Prisma.TransactionClient,
  | "content"
  | "contentRevision"
  | "contentDraft"
  | "$queryRaw"
  | "storageDeletion"
>;
type ContentSnapshot = ContentInput & { deletedAt: string | null };

function requireActor(
  actor: ContentActor,
): asserts actor is { id: string; isAdmin: true } {
  if (!actor?.id || !actor.isAdmin)
    throw new ContentHistoryError("FORBIDDEN", 403);
}
export function expectedRevision(value: unknown, allowZero = false): number {
  if (!Number.isSafeInteger(value) || (value as number) < (allowZero ? 0 : 1))
    throw new ContentHistoryError("VALIDATION_ERROR");
  return value as number;
}
function inputData(input: ContentInput) {
  const { translations, ...fields } = input;
  return {
    ...fields,
    translations: translations
      ? (translations as Prisma.InputJsonValue)
      : Prisma.DbNull,
  };
}
/** Hold referenced image rows until the content transaction commits. Deletion
 * takes the conflicting row lock; serializable callers detect a racing new
 * reference and preserve it when retrying the account deletion transaction. */
async function lockContentImages(tx: Tx, input: ContentInput) {
  const ids = new Set<string>();
  for (const body of [
    input.body,
    input.translations?.zh?.body,
    input.translations?.en?.body,
  ]) {
    for (const match of (body || "").matchAll(
      /\/api\/images\/([^\s/?#)"'<>\]\\]+)/g,
    )) {
      let id: string;
      try {
        id = decodeURIComponent(match[1]);
      } catch {
        throw new ContentHistoryError("IMAGE_UNAVAILABLE", 409);
      }
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id))
        throw new ContentHistoryError("IMAGE_UNAVAILABLE", 409);
      ids.add(id);
    }
  }
  if (!ids.size) return;
  const images = await tx.$queryRaw<
    { id: string; storagePath: string | null }[]
  >(Prisma.sql`
    SELECT "id", "storagePath" FROM "ImageAsset"
    WHERE "id" IN (${Prisma.join([...ids].sort())})
    ORDER BY "id" FOR KEY SHARE
  `);
  if (images.length !== ids.size)
    throw new ContentHistoryError("IMAGE_UNAVAILABLE", 409);
  const paths = images.flatMap((image) =>
    image.storagePath ? [image.storagePath] : [],
  );
  if (
    paths.length &&
    (await tx.storageDeletion.findFirst({
      where: { path: { in: paths } },
      select: { id: true },
    }))
  )
    throw new ContentHistoryError("IMAGE_UNAVAILABLE", 409);
}
export function contentSnapshot(content: Content): ContentSnapshot {
  const fields = validateContentInput({
    ...content,
    subjectSlug: content.subjectSlug ?? undefined,
    chapterSlug: content.chapterSlug ?? undefined,
    translations: content.translations ?? undefined,
    isPublished: false,
  });
  return {
    ...fields,
    isPublished: content.isPublished,
    deletedAt: content.deletedAt?.toISOString() ?? null,
  };
}
async function currentContent(tx: Tx, id: string, version: number) {
  expectedRevision(version);
  const existing = await tx.content.findUnique({ where: { id } });
  if (!existing) throw new ContentHistoryError("NOT_FOUND", 404);
  if (existing.version !== version)
    throw new ContentHistoryError("VERSION_CONFLICT", 409);
  return existing;
}
async function preserveBaseline(tx: Tx, existing: Content, actorId: string) {
  await tx.contentRevision.upsert({
    where: {
      contentId_version: { contentId: existing.id, version: existing.version },
    },
    update: {},
    create: {
      contentId: existing.id,
      version: existing.version,
      snapshot: contentSnapshot(existing) as unknown as Prisma.InputJsonValue,
      actorId,
      action: "baseline",
    },
  });
}
async function writeVersion(
  tx: Tx,
  existing: Content,
  input: ContentInput,
  deletedAt: Date | null,
  actorId: string,
  action: string,
) {
  if (action !== "trash") await lockContentImages(tx, input);
  await preserveBaseline(tx, existing, actorId);
  const changed = await tx.content.updateMany({
    where: { id: existing.id, version: existing.version },
    data: { ...inputData(input), deletedAt, version: existing.version + 1 },
  });
  if (changed.count !== 1)
    throw new ContentHistoryError("VERSION_CONFLICT", 409);
  const content = await tx.content.findUniqueOrThrow({
    where: { id: existing.id },
  });
  await tx.contentRevision.create({
    data: {
      contentId: content.id,
      version: content.version,
      snapshot: contentSnapshot(content) as unknown as Prisma.InputJsonValue,
      actorId,
      action,
    },
  });
  return content;
}
export async function createContentVersion(
  tx: Tx,
  actor: ContentActor,
  payload: unknown,
) {
  requireActor(actor);
  const input = validateContentInput(payload);
  await lockContentImages(tx, input);
  const content = await tx.content.create({
    data: { ...inputData(input), sourcePath: null },
  });
  await tx.contentRevision.create({
    data: {
      contentId: content.id,
      version: content.version,
      snapshot: contentSnapshot(content) as unknown as Prisma.InputJsonValue,
      actorId: actor.id,
      action: "create",
    },
  });
  return content;
}
export async function saveContentVersion(
  tx: Tx,
  actor: ContentActor,
  id: string,
  payload: unknown,
  bundled: boolean,
) {
  requireActor(actor);
  const body = object(payload);
  const existing = await currentContent(
    tx,
    id,
    expectedRevision(body.expectedVersion),
  );
  if (existing.deletedAt) throw new ContentHistoryError("CONTENT_TRASHED", 409);
  const input = validateContentInput(
    payload,
    existing as unknown as Record<string, unknown>,
  );
  if (bundled && input.slug !== existing.slug)
    throw new ContentHistoryError("BUNDLED_SLUG", 409);
  return writeVersion(tx, existing, input, null, actor.id, "save");
}
export async function trashContentVersion(
  tx: Tx,
  actor: ContentActor,
  id: string,
  version: number,
) {
  requireActor(actor);
  const existing = await currentContent(tx, id, version);
  if (existing.deletedAt) throw new ContentHistoryError("CONTENT_TRASHED", 409);
  const input = { ...contentSnapshot(existing), isPublished: false };
  return writeVersion(tx, existing, input, new Date(), actor.id, "trash");
}
export async function restoreContentVersion(
  tx: Tx,
  actor: ContentActor,
  id: string,
  version: number,
  fromVersion: number | undefined,
  bundled: boolean,
) {
  requireActor(actor);
  const existing = await currentContent(tx, id, version);
  let raw: unknown = existing;
  if (fromVersion !== undefined) {
    expectedRevision(fromVersion);
    const revision = await tx.contentRevision.findUnique({
      where: { contentId_version: { contentId: id, version: fromVersion } },
    });
    if (!revision) throw new ContentHistoryError("NOT_FOUND", 404);
    raw = revision.snapshot;
  } else if (!existing.deletedAt)
    throw new ContentHistoryError("VALIDATION_ERROR");
  const snapshot = object(raw);
  const input = validateContentInput({
    ...snapshot,
    subjectSlug: snapshot.subjectSlug ?? undefined,
    chapterSlug: snapshot.chapterSlug ?? undefined,
    translations: snapshot.translations ?? undefined,
    isPublished: false,
  });
  if (bundled && input.slug !== existing.slug)
    throw new ContentHistoryError("BUNDLED_SLUG", 409);
  return writeVersion(tx, existing, input, null, actor.id, "restore");
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ContentHistoryError("VALIDATION_ERROR");
  return value as Record<string, unknown>;
}
function allowKeys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new ContentHistoryError("VALIDATION_ERROR");
}
export function validateContentMutation(
  value: unknown,
): Record<string, unknown> {
  const input = object(value);
  allowKeys(input, [
    "title",
    "slug",
    "module",
    "body",
    "subjectSlug",
    "chapterSlug",
    "order",
    "isPublic",
    "isPublished",
    "previewRatio",
    "translations",
    "expectedVersion",
    "draftKey",
    "draftRevision",
  ]);
  if (input.translations !== undefined) {
    const translations = object(input.translations);
    allowKeys(translations, ["zh", "en"]);
    for (const entry of Object.values(translations))
      allowKeys(object(entry), ["title", "body", "subjectTitle"]);
  }
  return input;
}
const DRAFT_FIELDS = [
  "slug",
  "module",
  "subjectSlug",
  "chapterSlug",
  "order",
  "isPublic",
  "isPublished",
  "translations",
];
/** Autosave deliberately accepts unfinished editor fields, never public Content fields. */
export function validatePrivateDraftPayload(
  value: unknown,
): Record<string, unknown> {
  const input = object(value);
  allowKeys(input, DRAFT_FIELDS);
  const result: Record<string, unknown> = {};
  for (const key of ["slug", "module", "subjectSlug", "chapterSlug", "order"]) {
    if (input[key] === undefined) continue;
    const max =
      key === "slug" ? 240 : key === "module" ? 120 : key === "order" ? 6 : 80;
    if (
      typeof input[key] !== "string" ||
      input[key].length > max ||
      /[\u0000-\u001f]/u.test(input[key])
    )
      throw new ContentHistoryError("VALIDATION_ERROR");
    result[key] = input[key];
  }
  for (const key of ["isPublic", "isPublished"]) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== "boolean")
      throw new ContentHistoryError("VALIDATION_ERROR");
    result[key] = input[key];
  }
  if (input.translations !== undefined) {
    const translations = object(input.translations);
    allowKeys(translations, ["zh", "en"]);
    const clean: Record<string, unknown> = {};
    for (const locale of ["zh", "en"]) {
      if (translations[locale] === undefined) continue;
      const entry = object(translations[locale]);
      allowKeys(entry, ["title", "body", "subjectTitle"]);
      const target: Record<string, string> = {};
      for (const key of ["title", "body", "subjectTitle"]) {
        if (entry[key] === undefined) continue;
        if (
          typeof entry[key] !== "string" ||
          entry[key].length >
            (key === "body" ? 300_000 : key === "title" ? 240 : 160) ||
          entry[key].includes("\0")
        )
          throw new ContentHistoryError("VALIDATION_ERROR");
        target[key] = entry[key];
      }
      clean[locale] = target;
    }
    result.translations = clean;
  }
  return result;
}
export function validateDraftKey(key: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(key))
    throw new ContentHistoryError("VALIDATION_ERROR");
  return key;
}
export async function savePrivateDraft(
  tx: Tx,
  actor: ContentActor,
  key: string,
  value: unknown,
) {
  requireActor(actor);
  validateDraftKey(key);
  const input = object(value);
  allowKeys(input, ["payload", "expectedRevision", "contentId", "baseVersion"]);
  const revision = expectedRevision(input.expectedRevision, true);
  const payload = validatePrivateDraftPayload(
    input.payload,
  ) as Prisma.InputJsonValue;
  const contentId =
    input.contentId === null || input.contentId === undefined
      ? null
      : input.contentId;
  const baseVersion =
    input.baseVersion === null || input.baseVersion === undefined
      ? null
      : expectedRevision(input.baseVersion);
  if (
    contentId !== null &&
    (typeof contentId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(contentId))
  )
    throw new ContentHistoryError("VALIDATION_ERROR");
  if (contentId) {
    const content = await tx.content.findUnique({ where: { id: contentId } });
    if (!content || content.deletedAt)
      throw new ContentHistoryError("NOT_FOUND", 404);
  }
  const where = { userId_draftKey: { userId: actor.id, draftKey: key } };
  const existing = await tx.contentDraft.findUnique({ where });
  if (!existing) {
    if (revision !== 0) throw new ContentHistoryError("DRAFT_CONFLICT", 409);
    try {
      return await tx.contentDraft.create({
        data: {
          userId: actor.id,
          draftKey: key,
          contentId,
          baseVersion,
          payload,
          revision: 1,
        },
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      )
        throw new ContentHistoryError("DRAFT_CONFLICT", 409);
      throw error;
    }
  }
  if (existing.revision !== revision)
    throw new ContentHistoryError("DRAFT_CONFLICT", 409);
  const changed = await tx.contentDraft.updateMany({
    where: { userId: actor.id, draftKey: key, revision },
    data: { contentId, baseVersion, payload, revision: revision + 1 },
  });
  if (changed.count !== 1) throw new ContentHistoryError("DRAFT_CONFLICT", 409);
  return tx.contentDraft.findUniqueOrThrow({ where });
}
export async function deletePrivateDraft(
  tx: Tx,
  actor: ContentActor,
  key: string,
  revision: number,
) {
  requireActor(actor);
  validateDraftKey(key);
  expectedRevision(revision);
  const removed = await tx.contentDraft.deleteMany({
    where: { userId: actor.id, draftKey: key, revision },
  });
  if (removed.count !== 1) throw new ContentHistoryError("DRAFT_CONFLICT", 409);
}
