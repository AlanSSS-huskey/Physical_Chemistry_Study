import { createHmac } from "node:crypto";
import type { PrismaClient, Prisma, EmailActionPurpose } from "@prisma/client";
import {
  AccountError,
  accountSecret,
  normalizeAccountEmail,
  validatePassword,
  validateAccountName,
} from "./account-security.ts";
import {
  hashPassword,
  verifyPassword,
  createEmailToken,
  hashEmailToken,
  maskAccountEmail,
} from "./passwords.ts";
import {
  accountMailReady,
  sendAccountMail,
  type AccountMail,
} from "./account-mail.ts";
import { createSessionToken, sessionPersistence } from "./session-policy.ts";

type Input = Record<string, unknown>;
type Options = {
  db: PrismaClient;
  sendMail?: (mail: AccountMail) => Promise<void>;
  mailReady?: () => boolean;
  now?: () => number;
};
const dummyHash = `scrypt$131072$8$1$${"A".repeat(22)}$${"A".repeat(86)}`;
export function createEmailAuthService(options: Options) {
  const db = options.db;
  const now = options.now || Date.now;
  const mailReady = options.mailReady || accountMailReady;
  const mail = options.sendMail || sendAccountMail;
  const locale = (input: Input): "zh" | "en" =>
    input.locale === "en" ? "en" : "zh";
  function requireMail() {
    if (!mailReady()) throw new AccountError("MAIL_UNAVAILABLE", 503);
  }
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
        throw error;
      }
    }
  }
  async function limit(
    scope: string,
    identity: string,
    count: number,
    seconds: number,
  ) {
    const bucket = Math.floor(now() / (seconds * 1000));
    const key = createHmac("sha256", accountSecret())
      .update(`account-rate:${scope}:${identity}:${bucket}`)
      .digest("hex");
    const expiresAt = new Date((bucket + 1) * seconds * 1000);
    const row = await db.authRateLimit.upsert({
      where: { key },
      create: { key, count: 1, expiresAt },
      update: { count: { increment: 1 } },
    });
    if (row.count > count)
      throw new AccountError(
        "RATE_LIMITED",
        429,
        Math.max(1, Math.ceil((expiresAt.getTime() - now()) / 1000)),
      );
  }
  async function rate(
    action: string,
    email: string,
    request: Request,
    perEmail = 5,
  ) {
    // Vercel overwrites these headers; self-hosted deployments must provide a
    // trusted reverse proxy. Missing metadata uses one conservative bucket.
    const ip = (
      request.headers.get("x-vercel-forwarded-for") ||
      request.headers.get("x-forwarded-for") ||
      "unknown"
    )
      .split(",")[0]
      .trim()
      .slice(0, 128);
    await limit(`${action}-ip`, ip, 40, 900);
    await limit(`${action}-email`, email, perEmail, 900);
    await db.authRateLimit.deleteMany({
      where: { expiresAt: { lt: new Date(now() - 86400_000) } },
    });
  }
  async function findUser(email: string) {
    return db.user.findFirst({
      where: { email: { in: [email], mode: "insensitive" } },
      include: { passwordCredential: true },
    });
  }
  async function issue(
    email: string,
    purpose: EmailActionPurpose,
    userId: string | null,
    lang: "zh" | "en",
    registration?: { name: string; passwordHash: string },
  ) {
    const token = createEmailToken();
    const tokenHash = hashEmailToken(token);
    const expiresAt = new Date(
      now() + (purpose === "VERIFY_EMAIL" ? 86400_000 : 1800_000),
    );
    await transaction(async (tx) => {
      let registrationHash: string | null = null;
      if (purpose === "VERIFY_EMAIL") {
        const pending = registration
          ? await tx.pendingRegistration.upsert({
              where: { emailCanonical: email },
              create: { emailCanonical: email, ...registration, expiresAt },
              update: { ...registration, expiresAt },
            })
          : await tx.pendingRegistration.findUnique({
              where: { emailCanonical: email },
            });
        if (!pending) throw new AccountError("TOKEN_INVALID", 400);
        if (!registration)
          await tx.pendingRegistration.update({
            where: { id: pending.id },
            data: { expiresAt },
          });
        registrationHash = hashEmailToken(pending.passwordHash);
      }
      await tx.emailActionToken.deleteMany({
        where: { emailCanonical: email, purpose },
      });
      await tx.emailActionToken.create({
        data: {
          tokenHash,
          emailCanonical: email,
          userId,
          purpose,
          expiresAt,
          registrationHash,
        },
      });
    });
    try {
      await mail({ to: email, purpose, token, locale: lang });
    } catch (error) {
      await db.emailActionToken.deleteMany({ where: { tokenHash } });
      throw error;
    }
  }
  async function recovery(email: string, lang: "zh" | "en") {
    const user = await findUser(email);
    if (user)
      await issue(
        email,
        user.passwordCredential ? "RESET_PASSWORD" : "SET_PASSWORD",
        user.id,
        lang,
      );
    else await mail({ to: email, purpose: "ACCOUNT_HELP", locale: lang });
  }
  async function readToken(input: Input, expected: "verify" | "reset") {
    if (
      typeof input.token !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(input.token)
    )
      throw new AccountError("TOKEN_INVALID", 400);
    const token = await db.emailActionToken.findUnique({
      where: { tokenHash: hashEmailToken(input.token) },
    });
    if (
      !token ||
      (expected === "verify"
        ? token.purpose !== "VERIFY_EMAIL"
        : !["RESET_PASSWORD", "SET_PASSWORD"].includes(token.purpose))
    )
      throw new AccountError("TOKEN_INVALID", 400);
    if (token.expiresAt.getTime() <= now())
      throw new AccountError("TOKEN_EXPIRED", 400);
    if (expected === "verify") {
      const pending = await db.pendingRegistration.findUnique({
        where: { emailCanonical: token.emailCanonical },
      });
      if (!pending || pending.expiresAt.getTime() <= now())
        throw new AccountError("TOKEN_EXPIRED", 400);
      if (token.registrationHash !== hashEmailToken(pending.passwordHash))
        throw new AccountError("TOKEN_INVALID", 400);
    }
    return token;
  }
  return {
    async register(input: Input, request: Request) {
      requireMail();
      const email = normalizeAccountEmail(input.email);
      const name = validateAccountName(input.name);
      const password = validatePassword(input.password);
      await rate("register", email, request, 3);
      const passwordHash = await hashPassword(password);
      const user = await findUser(email);
      if (user) {
        await recovery(email, locale(input));
        return;
      }
      await issue(email, "VERIFY_EMAIL", null, locale(input), {
        name,
        passwordHash,
      });
    },
    async resendVerification(input: Input, request: Request) {
      requireMail();
      const email = normalizeAccountEmail(input.email);
      await rate("verification-mail", email, request, 3);
      const pending = await db.pendingRegistration.findUnique({
        where: { emailCanonical: email },
      });
      if (pending && !(await findUser(email)))
        await issue(email, "VERIFY_EMAIL", null, locale(input));
      else await recovery(email, locale(input));
    },
    async forgotPassword(input: Input, request: Request) {
      requireMail();
      const email = normalizeAccountEmail(input.email);
      await rate("reset-mail", email, request, 3);
      await recovery(email, locale(input));
    },
    async tokenStatus(input: Input, request: Request) {
      if (input.purpose !== "verify" && input.purpose !== "reset")
        throw new AccountError("VALIDATION_ERROR", 400);
      await rate(
        "token-status",
        String(input.token || "").slice(0, 100),
        request,
        30,
      );
      const token = await readToken(input, input.purpose);
      return {
        valid: true,
        purpose: input.purpose,
        emailMasked: maskAccountEmail(token.emailCanonical),
        expiresAt: token.expiresAt.toISOString(),
      };
    },
    async verify(input: Input, request: Request) {
      const password = validatePassword(input.password);
      const token = await readToken(input, "verify");
      await rate("verify", token.emailCanonical, request, 10);
      const pending = await db.pendingRegistration.findUnique({
        where: { emailCanonical: token.emailCanonical },
      });
      if (!pending || pending.expiresAt.getTime() <= now())
        throw new AccountError("TOKEN_EXPIRED", 400);
      if (!(await verifyPassword(password, pending.passwordHash)))
        throw new AccountError("PASSWORD_MISMATCH", 400);
      return transaction(async (tx) => {
        const user = await tx.user.findFirst({
          where: {
            email: { in: [token.emailCanonical], mode: "insensitive" },
          },
        });
        if (user) throw new AccountError("USE_PASSWORD_RESET", 409);
        const current = await tx.pendingRegistration.findUnique({
          where: { emailCanonical: token.emailCanonical },
        });
        if (
          !current ||
          current.passwordHash !== pending.passwordHash ||
          token.registrationHash !== hashEmailToken(current.passwordHash)
        )
          throw new AccountError("TOKEN_INVALID", 400);
        const consumed = await tx.emailActionToken.deleteMany({
          where: {
            tokenHash: token.tokenHash,
            purpose: "VERIFY_EMAIL",
            expiresAt: { gt: new Date(now()) },
          },
        });
        if (consumed.count !== 1) throw new AccountError("TOKEN_INVALID", 400);
        const created = await tx.user.create({
          data: {
            email: token.emailCanonical,
            name: current.name,
            emailVerified: new Date(now()),
            role: "USER",
          },
        });
        await tx.passwordCredential.create({
          data: { userId: created.id, passwordHash: current.passwordHash },
        });
        await tx.pendingRegistration.delete({ where: { id: current.id } });
        await tx.emailActionToken.deleteMany({
          where: { emailCanonical: token.emailCanonical },
        });
        return { ...created, passwordHash: current.passwordHash };
      });
    },
    async login(input: Input, request: Request) {
      const email = normalizeAccountEmail(input.email);
      if (
        typeof input.password !== "string" ||
        [...input.password].length > 128
      )
        throw new AccountError("INVALID_CREDENTIALS", 401);
      await rate("login", email, request, 10);
      const user = await findUser(email);
      const valid = await verifyPassword(
        input.password,
        user?.passwordCredential?.passwordHash || dummyHash,
      );
      if (!user?.passwordCredential || !user.emailVerified || !valid)
        throw new AccountError("INVALID_CREDENTIALS", 401);
      return {
        id: user.id,
        passwordHash: user.passwordCredential.passwordHash,
      };
    },
    async resetPassword(input: Input, request: Request) {
      const password = validatePassword(input.password);
      const token = await readToken(input, "reset");
      await rate("reset", token.emailCanonical, request, 5);
      const passwordHash = await hashPassword(password);
      await transaction(async (tx) => {
        if (!token.userId) throw new AccountError("TOKEN_INVALID", 400);
        const consumed = await tx.emailActionToken.deleteMany({
          where: {
            tokenHash: token.tokenHash,
            purpose: token.purpose,
            expiresAt: { gt: new Date(now()) },
          },
        });
        if (consumed.count !== 1) throw new AccountError("TOKEN_INVALID", 400);
        const user = await tx.user.findUnique({ where: { id: token.userId } });
        if (!user || user.email?.toLowerCase() !== token.emailCanonical)
          throw new AccountError("TOKEN_INVALID", 400);
        await tx.passwordCredential.upsert({
          where: { userId: user.id },
          create: { userId: user.id, passwordHash },
          update: { passwordHash },
        });
        await tx.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date(now()) },
        });
        await tx.session.deleteMany({ where: { userId: user.id } });
        await tx.emailActionToken.deleteMany({ where: { userId: user.id } });
        await tx.emailChangeRequest.deleteMany({ where: { userId: user.id } });
        await tx.accountDeletionRequest.deleteMany({
          where: { userId: user.id },
        });
        await tx.pendingRegistration.deleteMany({
          where: { emailCanonical: token.emailCanonical },
        });
      });
    },
    async changePassword(
      input: Input,
      userId: string,
      sessionToken: string,
      request: Request,
    ) {
      const password = validatePassword(input.password);
      await rate("password-change", userId, request, 5);
      const credential = await db.passwordCredential.findUnique({
        where: { userId },
      });
      if (!credential) throw new AccountError("PASSWORD_NOT_SET", 409);
      if (
        typeof input.currentPassword !== "string" ||
        [...input.currentPassword].length > 128 ||
        !(await verifyPassword(input.currentPassword, credential.passwordHash))
      )
        throw new AccountError("INVALID_CREDENTIALS", 401);
      const passwordHash = await hashPassword(password);
      return transaction(async (tx) => {
        const changed = await tx.passwordCredential.updateMany({
          where: { userId, passwordHash: credential.passwordHash },
          data: { passwordHash },
        });
        if (changed.count !== 1)
          throw new AccountError("INVALID_CREDENTIALS", 401);
        const session = await tx.session.findUnique({
          where: { sessionToken },
        });
        if (
          !session ||
          session.userId !== userId ||
          session.expires.getTime() <= now()
        )
          throw new AccountError("UNAUTHENTICATED", 401);
        await tx.session.deleteMany({
          where: { userId, sessionToken: { not: sessionToken } },
        });
        await tx.emailActionToken.deleteMany({ where: { userId } });
        await tx.emailChangeRequest.deleteMany({ where: { userId } });
        await tx.accountDeletionRequest.deleteMany({ where: { userId } });
        return tx.session.update({
          where: { id: session.id },
          data: {
            sessionToken: createSessionToken(
              sessionPersistence(session.sessionToken) === "persistent",
            ),
            lastActiveAt: new Date(now()),
          },
        });
      });
    },
  };
}
