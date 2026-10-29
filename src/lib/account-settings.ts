import type { Prisma, Session } from "@prisma/client";
import { AccountError, validateAccountName } from "./account-security.ts";
import { sessionPersistence } from "./session-policy.ts";

type ProfileRecord = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  emailVerified: Date | null;
  passwordCredential: { userId: string } | null;
  accounts: { provider: string }[];
};

export const accountProfileSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
  emailVerified: true,
  passwordCredential: { select: { userId: true } },
  accounts: { where: { provider: "google" }, select: { provider: true } },
} satisfies Prisma.UserSelect;

export function publicAccountProfile(user: ProfileRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    emailVerified: Boolean(user.emailVerified),
    hasPassword: Boolean(user.passwordCredential),
    googleLinked: user.accounts.some(
      (account) => account.provider === "google",
    ),
  };
}

export function accountNameChange(body: Record<string, unknown>): {
  name: string;
} {
  if (Object.keys(body).some((key) => key !== "name"))
    throw new AccountError("VALIDATION_ERROR", 400);
  return { name: validateAccountName(body.name) };
}

function deviceName(agent: string | null): string {
  if (!agent) return "Unknown browser";
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /OPR\//.test(agent)
      ? "Opera"
      : /Firefox\/|FxiOS\//.test(agent)
        ? "Firefox"
        : /Chrome\/|CriOS\//.test(agent)
          ? "Chrome"
          : /Safari\//.test(agent)
            ? "Safari"
            : "Browser";
  const system = /iPhone|iPod/.test(agent)
    ? "iPhone"
    : /iPad/.test(agent)
      ? "iPad"
      : /Android/.test(agent)
        ? "Android"
        : /Windows/.test(agent)
          ? "Windows"
          : /Macintosh|Mac OS X/.test(agent)
            ? "macOS"
            : /Linux/.test(agent)
              ? "Linux"
              : null;
  return system ? `${browser} · ${system}` : browser;
}

export function accountSessionView(session: Session, currentId: string) {
  return {
    id: session.id,
    current: session.id === currentId,
    device: deviceName(session.userAgent),
    createdAt: session.createdAt.toISOString(),
    lastActiveAt: session.lastActiveAt.toISOString(),
    expiresAt: session.expires.toISOString(),
    remembered: sessionPersistence(session.sessionToken) === "persistent",
  };
}

export async function revokeAccountSessions(
  store: Pick<Prisma.TransactionClient["session"], "deleteMany">,
  userId: string,
  currentId: string,
  targetId?: string,
) {
  if (targetId && !/^[a-zA-Z0-9_-]{1,128}$/.test(targetId))
    throw new AccountError("NOT_FOUND", 404);
  const result = await store.deleteMany({
    where: { userId, id: targetId || { not: currentId } },
  });
  if (targetId && !result.count) throw new AccountError("NOT_FOUND", 404);
  return { currentRevoked: targetId === currentId };
}
