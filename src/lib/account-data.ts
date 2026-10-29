import { createHmac } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  AccountError,
  accountSecret,
  normalizeAccountEmail,
} from "./account-security.ts";
import {
  createEmailToken,
  hashEmailToken,
  verifyPassword,
  maskAccountEmail,
} from "./passwords.ts";
import {
  accountMailReady,
  sendAccountMail,
  type AccountMail,
} from "./account-mail.ts";

type Input = Record<string, unknown>;
/** Bind sensitive actions to the account whose settings the user reviewed. */
export function requireAccountDataIdentity<T extends { userId: string }>(
  request: Request,
  session: T | null,
): T {
  if (!session) throw new AccountError("UNAUTHENTICATED", 401);
  if (request.headers.get("x-account-user") !== session.userId)
    throw new AccountError("SESSION_CHANGED", 409);
  return session;
}
type ExportInput = {
  profile: object;
  preferences?: object | null;
  readingPositions?: object[];
  bookmarks?: object[];
  notes?: object[];
  progress?: object[];
  exportedAt?: Date;
};
function pick(
  value: object,
  fields: readonly string[],
): Record<string, unknown> {
  const row = value as Record<string, unknown>;
  return Object.fromEntries(fields.map((key) => [key, row[key] ?? null]));
}
/** A second allowlist protects exports even if a repository accidentally over-selects. */
export function accountDataExport(data: ExportInput) {
  return {
    format: "physical-chemistry-account",
    version: 1,
    exportedAt: (data.exportedAt || new Date()).toISOString(),
    profile: pick(data.profile, [
      "id",
      "name",
      "email",
      "emailVerified",
      "image",
      "createdAt",
    ]),
    preferences: data.preferences
      ? pick(data.preferences, [
          "fontSize",
          "lineHeight",
          "theme",
          "revision",
          "updatedAt",
        ])
      : null,
    readingPositions: (data.readingPositions || []).map((row) =>
      pick(row, [
        "contentSlug",
        "locale",
        "anchor",
        "progress",
        "revision",
        "updatedAt",
      ]),
    ),
    bookmarks: (data.bookmarks || []).map((row) =>
      pick(row, ["contentSlug", "createdAt"]),
    ),
    notes: (data.notes || []).map((row) =>
      pick(row, ["contentSlug", "locale", "body", "revision", "updatedAt"]),
    ),
    progress: (data.progress || []).map((row) =>
      pick(row, [
        "contentSlug",
        "status",
        "completedAt",
        "createdAt",
        "updatedAt",
      ]),
    ),
  };
}
type Options = {
  db: PrismaClient;
  sendMail?: (mail: AccountMail) => Promise<void>;
  mailReady?: () => boolean;
  checkPassword?: typeof verifyPassword;
  deleteObject?: (path: string) => Promise<void>;
  now?: () => number;
};
const ownerSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  image: true,
  passwordCredential: { select: { passwordHash: true } },
} satisfies Prisma.UserSelect;
type Owner = Prisma.UserGetPayload<{ select: typeof ownerSelect }>;
const PROOF_LIFETIME = 1800_000;

export function createAccountDataService(options: Options) {
  const db = options.db;
  const now = options.now || Date.now;
  const mailReady = options.mailReady || accountMailReady;
  const mail = options.sendMail || sendAccountMail;
  const checkPassword = options.checkPassword || verifyPassword;
  const locale = (input: Input): "zh" | "en" =>
    input.locale === "en" ? "en" : "zh";
  async function transaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await db.$transaction(operation, {
          isolationLevel: "Serializable",
          maxWait: 5000,
          timeout: 15000,
        });
      } catch (error) {
        if (
          attempt < 2 &&
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2034"
        )
          continue;
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2002"
        )
          throw new AccountError("EMAIL_UNAVAILABLE", 409);
        throw error;
      }
    }
  }
  async function owner(
    userId: string,
    tx: Pick<Prisma.TransactionClient, "user"> = db,
  ): Promise<Owner> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: ownerSelect,
    });
    if (!user) throw new AccountError("UNAUTHENTICATED", 401);
    return user;
  }
  async function rate(action: string, identity: string, maximum = 5) {
    const bucket = Math.floor(now() / 3600_000);
    const key = createHmac("sha256", accountSecret())
      .update(`account-data:${action}:${identity}:${bucket}`)
      .digest("hex");
    const expiresAt = new Date((bucket + 1) * 3600_000);
    const row = await db.authRateLimit.upsert({
      where: { key },
      create: { key, count: 1, expiresAt },
      update: { count: { increment: 1 } },
    });
    if (row.count > maximum)
      throw new AccountError(
        "RATE_LIMITED",
        429,
        Math.max(1, Math.ceil((expiresAt.getTime() - now()) / 1000)),
      );
  }
  async function proofRate(
    action: string,
    tokenHash: string,
    request: Request,
    maximum = 20,
  ) {
    const ip = (
      request.headers.get("x-vercel-forwarded-for") ||
      request.headers.get("x-forwarded-for") ||
      "unknown"
    )
      .split(",")[0]
      .trim()
      .slice(0, 128);
    await rate("proof-ip", ip, 60);
    await rate(action, tokenHash, maximum);
  }
  function proof(input: Input): string {
    if (
      typeof input.token !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(input.token)
    )
      throw new AccountError("TOKEN_INVALID", 400);
    return hashEmailToken(input.token);
  }
  function requireMail() {
    if (!mailReady()) throw new AccountError("MAIL_UNAVAILABLE", 503);
  }
  async function requirePassword(user: Owner, input: Input) {
    if (
      user.passwordCredential &&
      (typeof input.currentPassword !== "string" ||
        [...input.currentPassword].length > 128 ||
        !(await checkPassword(
          input.currentPassword,
          user.passwordCredential.passwordHash,
        )))
    )
      throw new AccountError("CURRENT_PASSWORD_INVALID", 401);
  }
  function samePasswordVersion(before: Owner, current: Owner) {
    if (
      before.passwordCredential?.passwordHash !==
      current.passwordCredential?.passwordHash
    )
      throw new AccountError("REAUTH_REQUIRED", 401);
  }
  async function availableEmail(
    email: string,
    userId: string,
    tx: Pick<Prisma.TransactionClient, "user"> = db,
  ) {
    const duplicate = await tx.user.findFirst({
      where: {
        email: { in: [email], mode: "insensitive" },
        id: { not: userId },
      },
      select: { id: true },
    });
    if (duplicate) throw new AccountError("EMAIL_UNAVAILABLE", 409);
  }
  async function protectLastAdmin(user: Owner, tx: Prisma.TransactionClient) {
    if (
      user.role === "ADMIN" &&
      (await tx.user.count({ where: { role: "ADMIN" } })) <= 1
    )
      throw new AccountError("LAST_ADMIN", 409);
  }
  async function cleanup(maximum = 3, paths?: string[]) {
    const pending = await db.storageDeletion.findMany({
      where: paths ? { path: { in: paths } } : {},
      orderBy: { createdAt: "asc" },
      take: Math.min(3, Math.max(1, maximum)),
      select: { id: true, path: true },
    });
    let removed = 0;
    for (const item of pending) {
      try {
        if (!options.deleteObject) throw new Error("Storage unavailable");
        await options.deleteObject(item.path);
        await db.storageDeletion.deleteMany({
          where: { id: item.id, path: item.path },
        });
        removed++;
      } catch {
        await db.storageDeletion.updateMany({
          where: { id: item.id, path: item.path },
          data: { attempts: { increment: 1 } },
        });
      }
    }
    return {
      processed: pending.length,
      removed,
      remaining: await db.storageDeletion.count({
        where: paths ? { path: { in: paths } } : {},
      }),
    };
  }
  async function removeUser(
    tx: Prisma.TransactionClient,
    user: Owner,
  ): Promise<string[]> {
    await protectLastAdmin(user, tx);
    const candidates = await tx.imageAsset.findMany({
      where: { uploadedBy: user.id, purpose: "AVATAR" },
      select: { id: true, url: true, storagePath: true },
    });
    // Predicate reads stay inside this serializable transaction. Filter in the
    // database and return at most an id, never multi-megabyte article/history
    // bodies. A conservative substring match retains an ambiguous reference.
    const avatars: typeof candidates = [];
    for (const avatar of candidates) {
      const needles = [
        ...new Set([avatar.url, `/api/images/${avatar.id}`].filter(Boolean)),
      ];
      const jsonReferences = (
        field: "translations" | "payload" | "snapshot",
        nested: boolean,
      ) =>
        needles.flatMap((needle) => [
          ...(nested
            ? [{ [field]: { path: ["body"], string_contains: needle } }]
            : []),
          ...["zh", "en"].map((language) => ({
            [field]: {
              path: [...(nested ? ["translations"] : []), language, "body"],
              string_contains: needle,
            },
          })),
        ]);
      const [published, draft, revision] = await Promise.all([
        tx.content.findFirst({
          where: {
            OR: [
              ...needles.map((needle) => ({ body: { contains: needle } })),
              ...jsonReferences("translations", false),
            ],
          },
          select: { id: true },
        }),
        tx.contentDraft.findFirst({
          where: { OR: jsonReferences("payload", true) },
          select: { id: true },
        }),
        tx.contentRevision.findFirst({
          where: { OR: jsonReferences("snapshot", true) },
          select: { id: true },
        }),
      ]);
      if (!published && !draft && !revision) avatars.push(avatar);
    }
    const paths: string[] = [];
    for (const avatar of avatars)
      if (avatar.storagePath) {
        if (
          !avatar.storagePath.startsWith(`${user.id}/`) ||
          !/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/.test(avatar.storagePath)
        )
          throw new AccountError("UNAVAILABLE", 503);
        await tx.storageDeletion.upsert({
          where: { path: avatar.storagePath },
          create: { path: avatar.storagePath },
          update: {},
        });
        paths.push(avatar.storagePath);
      }
    await tx.imageAsset.deleteMany({
      where: {
        uploadedBy: user.id,
        id: { in: avatars.map((avatar) => avatar.id) },
      },
    });
    if (user.email)
      await tx.pendingRegistration.deleteMany({
        where: { emailCanonical: user.email.toLowerCase() },
      });
    // Foreign keys cascade private records and set public CONTENT owners null.
    await tx.user.delete({ where: { id: user.id } });
    return paths;
  }
  async function afterDeletion(paths: string[]) {
    try {
      const result = paths.length ? await cleanup(1, paths) : { remaining: 0 };
      return { deleted: true, cleanupPending: result.remaining > 0 };
    } catch {
      return { deleted: true, cleanupPending: true };
    }
  }
  return {
    async export(userId: string) {
      await rate("export", userId, 10);
      return transaction(async (tx) => {
        const profile = await tx.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            email: true,
            emailVerified: true,
            image: true,
            createdAt: true,
          },
        });
        if (!profile) throw new AccountError("UNAUTHENTICATED", 401);
        const [preferences, readingPositions, bookmarks, notes, progress] =
          await Promise.all([
            tx.studyPreference.findUnique({
              where: { userId },
              select: {
                fontSize: true,
                lineHeight: true,
                theme: true,
                revision: true,
                updatedAt: true,
              },
            }),
            tx.readingPosition.findMany({
              where: { userId },
              orderBy: { updatedAt: "asc" },
              select: {
                contentSlug: true,
                locale: true,
                anchor: true,
                progress: true,
                revision: true,
                updatedAt: true,
              },
            }),
            tx.bookmark.findMany({
              where: { userId },
              orderBy: { createdAt: "asc" },
              select: { contentSlug: true, createdAt: true },
            }),
            tx.personalNote.findMany({
              where: { userId },
              orderBy: { updatedAt: "asc" },
              select: {
                contentSlug: true,
                locale: true,
                body: true,
                revision: true,
                updatedAt: true,
              },
            }),
            tx.progress.findMany({
              where: { userId },
              orderBy: { createdAt: "asc" },
              select: {
                contentSlug: true,
                status: true,
                completedAt: true,
                createdAt: true,
                updatedAt: true,
              },
            }),
          ]);
        return accountDataExport({
          profile,
          preferences,
          readingPositions,
          bookmarks,
          notes,
          progress,
          exportedAt: new Date(now()),
        });
      });
    },
    async summary(userId: string) {
      const user = await owner(userId);
      return {
        mail: mailReady(),
        hasPassword: Boolean(user.passwordCredential),
        isAdmin: user.role === "ADMIN",
        ...(user.role === "ADMIN"
          ? { storageCleanupPending: await db.storageDeletion.count() }
          : {}),
      };
    },
    async requestEmailChange(userId: string, input: Input, _request: Request) {
      void _request;
      requireMail();
      const user = await owner(userId);
      const email = normalizeAccountEmail(input.email);
      if (!user.email) throw new AccountError("EMAIL_REQUIRED", 409);
      if (user.email.toLowerCase() === email)
        throw new AccountError("EMAIL_UNCHANGED", 400);
      await rate("email-change", userId);
      await rate("email-target", email, 3);
      await requirePassword(user, input);
      await availableEmail(email, userId);
      const oldToken = createEmailToken();
      const newToken = createEmailToken();
      const pending = await transaction(async (tx) => {
        const current = await owner(userId, tx);
        samePasswordVersion(user, current);
        if (current.email !== user.email)
          throw new AccountError("REQUEST_REPLACED", 409);
        await availableEmail(email, userId, tx);
        await tx.emailChangeRequest.deleteMany({ where: { userId } });
        return tx.emailChangeRequest.create({
          data: {
            userId,
            previousEmail: user.email!,
            emailCanonical: email,
            oldTokenHash: hashEmailToken(oldToken),
            newTokenHash: hashEmailToken(newToken),
            expiresAt: new Date(0),
          },
        });
      });
      let accepted = false;
      try {
        await mail({
          to: user.email,
          purpose: "EMAIL_CHANGE_OLD",
          token: oldToken,
          contextEmail: email,
          locale: locale(input),
        });
        accepted = true;
        await mail({
          to: email,
          purpose: "EMAIL_CHANGE_NEW",
          token: newToken,
          contextEmail: user.email,
          locale: locale(input),
        });
      } catch {
        await db.emailChangeRequest.deleteMany({
          where: { id: pending.id, userId },
        });
        throw new AccountError(
          accepted ? "MAIL_PARTIAL" : "MAIL_UNAVAILABLE",
          503,
        );
      }
      await transaction(async (tx) => {
        const current = await owner(userId, tx);
        samePasswordVersion(user, current);
        if (current.email !== user.email)
          throw new AccountError("REQUEST_REPLACED", 409);
        await availableEmail(email, userId, tx);
        const activated = await tx.emailChangeRequest.updateMany({
          where: { id: pending.id, userId, expiresAt: new Date(0) },
          data: { expiresAt: new Date(now() + PROOF_LIFETIME) },
        });
        if (activated.count !== 1)
          throw new AccountError("REQUEST_REPLACED", 409);
      });
      return { requested: true };
    },
    async emailChangeStatus(input: Input, request: Request) {
      const tokenHash = proof(input);
      await proofRate("email-status", tokenHash, request);
      const pending = await db.emailChangeRequest.findFirst({
        where: {
          OR: [{ oldTokenHash: tokenHash }, { newTokenHash: tokenHash }],
        },
      });
      if (!pending) throw new AccountError("TOKEN_INVALID", 400);
      if (pending.expiresAt.getTime() <= now())
        throw new AccountError("TOKEN_EXPIRED", 400);
      const user = await owner(pending.userId);
      if (user.email !== pending.previousEmail)
        throw new AccountError("REQUEST_REPLACED", 409);
      const side = pending.oldTokenHash === tokenHash ? "old" : "new";
      if (side === "old" ? pending.oldConfirmedAt : pending.newConfirmedAt)
        throw new AccountError("TOKEN_INVALID", 400);
      return {
        previousEmailMasked: maskAccountEmail(pending.previousEmail),
        emailMasked: maskAccountEmail(pending.emailCanonical),
        side,
        expiresAt: pending.expiresAt.toISOString(),
      };
    },
    async confirmEmailChange(input: Input, request: Request) {
      if (input.confirm !== true)
        throw new AccountError("CONFIRMATION_REQUIRED", 400);
      const tokenHash = proof(input);
      await proofRate("email-confirm", tokenHash, request);
      return transaction(async (tx) => {
        const pending = await tx.emailChangeRequest.findFirst({
          where: {
            OR: [{ oldTokenHash: tokenHash }, { newTokenHash: tokenHash }],
          },
        });
        if (!pending) throw new AccountError("TOKEN_INVALID", 400);
        if (pending.expiresAt.getTime() <= now())
          throw new AccountError("TOKEN_EXPIRED", 400);
        const user = await owner(pending.userId, tx);
        if (user.email !== pending.previousEmail)
          throw new AccountError("REQUEST_REPLACED", 409);
        const side =
          pending.oldTokenHash === tokenHash
            ? "oldConfirmedAt"
            : "newConfirmedAt";
        if (pending[side]) throw new AccountError("TOKEN_INVALID", 400);
        const consumed = await tx.emailChangeRequest.updateMany({
          where: {
            id: pending.id,
            [side]: null,
            expiresAt: { gt: new Date(now()) },
          },
          data: { [side]: new Date(now()) },
        });
        if (consumed.count !== 1) throw new AccountError("TOKEN_INVALID", 400);
        const confirmed = await tx.emailChangeRequest.findUnique({
          where: { id: pending.id },
        });
        if (!confirmed?.oldConfirmedAt || !confirmed.newConfirmedAt)
          return { completed: false };
        await availableEmail(pending.emailCanonical, user.id, tx);
        const changed = await tx.user.updateMany({
          where: { id: user.id, email: pending.previousEmail },
          data: {
            email: pending.emailCanonical,
            emailVerified: new Date(now()),
          },
        });
        if (changed.count !== 1)
          throw new AccountError("REQUEST_REPLACED", 409);
        await tx.session.deleteMany({ where: { userId: user.id } });
        await tx.emailActionToken.deleteMany({ where: { userId: user.id } });
        await tx.pendingRegistration.deleteMany({
          where: {
            emailCanonical: {
              in: [pending.previousEmail.toLowerCase(), pending.emailCanonical],
            },
          },
        });
        await tx.accountDeletionRequest.deleteMany({
          where: { userId: user.id },
        });
        await tx.emailChangeRequest.deleteMany({ where: { userId: user.id } });
        return { completed: true, userId: user.id };
      });
    },
    async requestDeletion(userId: string, input: Input, _request: Request) {
      void _request;
      if (input.confirmation !== "DELETE")
        throw new AccountError("CONFIRMATION_REQUIRED", 400);
      await rate("account-delete", userId);
      const user = await owner(userId);
      await requirePassword(user, input);
      if (user.passwordCredential) {
        const paths = await transaction(async (tx) => {
          const current = await owner(userId, tx);
          samePasswordVersion(user, current);
          return removeUser(tx, current);
        });
        return afterDeletion(paths);
      }
      requireMail();
      if (!user.email) throw new AccountError("EMAIL_REQUIRED", 409);
      const token = createEmailToken();
      const pending = await transaction(async (tx) => {
        const current = await owner(userId, tx);
        samePasswordVersion(user, current);
        await protectLastAdmin(current, tx);
        if (current.email !== user.email)
          throw new AccountError("REQUEST_REPLACED", 409);
        await tx.accountDeletionRequest.deleteMany({ where: { userId } });
        return tx.accountDeletionRequest.create({
          data: {
            userId,
            tokenHash: hashEmailToken(token),
            expiresAt: new Date(0),
          },
        });
      });
      try {
        await mail({
          to: user.email,
          purpose: "ACCOUNT_DELETE",
          token,
          locale: locale(input),
        });
      } catch {
        await db.accountDeletionRequest.deleteMany({
          where: { id: pending.id, userId },
        });
        throw new AccountError("MAIL_UNAVAILABLE", 503);
      }
      await transaction(async (tx) => {
        const current = await owner(userId, tx);
        samePasswordVersion(user, current);
        await protectLastAdmin(current, tx);
        if (current.email !== user.email)
          throw new AccountError("REQUEST_REPLACED", 409);
        const activated = await tx.accountDeletionRequest.updateMany({
          where: { id: pending.id, userId, expiresAt: new Date(0) },
          data: { expiresAt: new Date(now() + PROOF_LIFETIME) },
        });
        if (activated.count !== 1)
          throw new AccountError("REQUEST_REPLACED", 409);
      });
      return { deleted: false, requested: true };
    },
    async deletionStatus(input: Input, request: Request) {
      const tokenHash = proof(input);
      await proofRate("delete-status", tokenHash, request);
      const pending = await db.accountDeletionRequest.findUnique({
        where: { tokenHash },
      });
      if (!pending) throw new AccountError("TOKEN_INVALID", 400);
      if (pending.expiresAt.getTime() <= now())
        throw new AccountError("TOKEN_EXPIRED", 400);
      const user = await owner(pending.userId);
      if (user.passwordCredential)
        throw new AccountError("REAUTH_REQUIRED", 401);
      return {
        emailMasked: maskAccountEmail(user.email || "?@?"),
        expiresAt: pending.expiresAt.toISOString(),
      };
    },
    async confirmDeletion(input: Input, request: Request) {
      if (input.confirmation !== "DELETE")
        throw new AccountError("CONFIRMATION_REQUIRED", 400);
      const tokenHash = proof(input);
      await proofRate("delete-confirm", tokenHash, request, 10);
      const deleted = await transaction(async (tx) => {
        const pending = await tx.accountDeletionRequest.findUnique({
          where: { tokenHash },
        });
        if (!pending) throw new AccountError("TOKEN_INVALID", 400);
        if (pending.expiresAt.getTime() <= now())
          throw new AccountError("TOKEN_EXPIRED", 400);
        const user = await owner(pending.userId, tx);
        if (user.passwordCredential)
          throw new AccountError("REAUTH_REQUIRED", 401);
        const consumed = await tx.accountDeletionRequest.deleteMany({
          where: {
            id: pending.id,
            tokenHash,
            expiresAt: { gt: new Date(now()) },
          },
        });
        if (consumed.count !== 1) throw new AccountError("TOKEN_INVALID", 400);
        return { paths: await removeUser(tx, user), userId: user.id };
      });
      return {
        ...(await afterDeletion(deleted.paths)),
        userId: deleted.userId,
      };
    },
    async retryStorageCleanup(userId: string) {
      const user = await owner(userId);
      if (user.role !== "ADMIN") throw new AccountError("FORBIDDEN", 403);
      await rate("storage-cleanup", userId, 10);
      return cleanup(3);
    },
  };
}
