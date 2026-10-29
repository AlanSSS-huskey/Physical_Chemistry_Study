import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  AccountError,
  accountFailure,
  getAccountMutation,
} from "@/lib/account-security";
import { getCurrentAccountSession } from "@/lib/account-sessions";
import { loadContent } from "@/lib/content-service";
import { resolveContentAccess } from "@/lib/content-access";
import { assertStudyOwner } from "./study-privacy.ts";
import {
  defaultStudyPreferences,
  saveStudyRevision,
  StudyConflict,
  validateStudyIdentity,
  validateStudyNote,
  validateStudyPosition,
  validateStudyPreferences,
  type StudyLocale,
} from "./study-state.ts";

export function studyResponse(data: unknown, userId: string) {
  return Response.json(
    { ok: true, userId, data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export function studyFailure(error: unknown) {
  if (error instanceof StudyConflict)
    return Response.json(
      { ok: false, code: "CONFLICT", current: publicStudyState(error.current) },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  return accountFailure(error);
}
export async function studyUser(request: Request) {
  const session = await getCurrentAccountSession(request);
  if (!session) throw new AccountError("UNAUTHENTICATED", 401);
  assertStudyOwner(request.headers.get("x-study-user"), session.userId);
  return session.userId;
}
function publicStudyState(value: unknown): unknown {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const allowed = [
    "body",
    "revision",
    "fontSize",
    "lineHeight",
    "theme",
    "anchor",
    "progress",
    "updatedAt",
  ];
  return Object.fromEntries(
    allowed.filter((key) => key in row).map((key) => [key, row[key]]),
  );
}
export async function requireStudyContent(
  contentSlug: string,
  locale: StudyLocale,
  userId: string,
) {
  const { content, databaseAvailable } = await loadContent(contentSlug, locale);
  if (!content)
    throw new AccountError(
      databaseAvailable ? "NOT_FOUND" : "UNAVAILABLE",
      databaseAvailable ? 404 : 503,
    );
  if ((await resolveContentAccess(content, userId)) !== "full")
    throw new AccountError("NOT_FOUND", 404);
  return content;
}
export async function studyIdentity(request: Request, userId: string) {
  const params = new URL(request.url).searchParams;
  const identity = validateStudyIdentity({
    slug: params.get("slug"),
    locale: params.get("locale"),
  });
  await requireStudyContent(identity.contentSlug, identity.locale, userId);
  return identity;
}
export async function readPreferences(userId: string) {
  const row = await prisma.studyPreference.findUnique({ where: { userId } });
  return row
    ? publicStudyState(row)
    : { ...defaultStudyPreferences, updatedAt: null };
}
export async function writePreferences(
  userId: string,
  body: Record<string, unknown>,
) {
  const { revision, ...value } = validateStudyPreferences(body);
  const save = (db: Pick<Prisma.TransactionClient, "studyPreference">) =>
    saveStudyRevision(
      {
        read: () => db.studyPreference.findUnique({ where: { userId } }),
        create: (data) =>
          db.studyPreference.create({ data: { userId, ...data } }),
        update: async (expected, data) =>
          (
            await db.studyPreference.updateMany({
              where: { userId, revision: expected },
              data: { ...data, revision: { increment: 1 } },
            })
          ).count === 1,
      },
      value,
      revision,
    );
  const result =
    revision === 0 ? await save(prisma) : await prisma.$transaction(save);
  return publicStudyState(result);
}
export async function readChapterState(
  kind: "note" | "position",
  userId: string,
  identity: { contentSlug: string; locale: StudyLocale },
) {
  const key = { userId, ...identity };
  const row =
    kind === "note"
      ? await prisma.personalNote.findUnique({
          where: { userId_contentSlug_locale: key },
        })
      : await prisma.readingPosition.findUnique({
          where: { userId_contentSlug_locale: key },
        });
  // A chapter losing access must not take away its owner's original writing.
  if (kind === "note" && !row)
    await requireStudyContent(identity.contentSlug, identity.locale, userId);
  return row
    ? publicStudyState(row)
    : kind === "note"
      ? { body: "", revision: 0, updatedAt: null }
      : { anchor: null, progress: 0, revision: 0, updatedAt: null };
}
export async function writeChapterState(
  kind: "note" | "position",
  request: Request,
) {
  const body = await getAccountMutation(request);
  const userId = await studyUser(request);
  const identity = validateStudyIdentity(body);
  const key = { userId, ...identity };
  if (kind === "note") {
    const existing = await prisma.personalNote.findUnique({
      where: { userId_contentSlug_locale: key },
      select: { id: true },
    });
    if (!existing)
      await requireStudyContent(identity.contentSlug, identity.locale, userId);
    const { revision, ...value } = validateStudyNote(body);
    const save = (db: Pick<Prisma.TransactionClient, "personalNote">) =>
      saveStudyRevision(
        {
          read: () =>
            db.personalNote.findUnique({
              where: { userId_contentSlug_locale: key },
            }),
          create: (data) =>
            db.personalNote.create({ data: { ...key, ...data } }),
          update: async (expected, data) =>
            (
              await db.personalNote.updateMany({
                where: { ...key, revision: expected },
                data: { ...data, revision: { increment: 1 } },
              })
            ).count === 1,
        },
        value,
        revision,
      );
    return studyResponse(
      publicStudyState(
        revision === 0 ? await save(prisma) : await prisma.$transaction(save),
      ),
      userId,
    );
  }
  await requireStudyContent(identity.contentSlug, identity.locale, userId);
  const { revision, ...value } = validateStudyPosition(body);
  const save = (db: Pick<Prisma.TransactionClient, "readingPosition">) =>
    saveStudyRevision(
      {
        read: () =>
          db.readingPosition.findUnique({
            where: { userId_contentSlug_locale: key },
          }),
        create: (data) =>
          db.readingPosition.create({ data: { ...key, ...data } }),
        update: async (expected, data) =>
          (
            await db.readingPosition.updateMany({
              where: { ...key, revision: expected },
              data: { ...data, revision: { increment: 1 } },
            })
          ).count === 1,
      },
      value,
      revision,
    );
  return studyResponse(
    publicStudyState(
      revision === 0 ? await save(prisma) : await prisma.$transaction(save),
    ),
    userId,
  );
}
