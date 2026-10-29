import type { Prisma, Session } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  accountSessionToken,
  accountSecureCookies,
} from "./account-security.ts";
import {
  BROWSER_SESSION_SECONDS,
  REMEMBERED_SESSION_SECONDS,
  createSessionToken,
  sessionPersistence,
} from "./session-policy.ts";

export type CurrentAccountSession = Session;
type SessionDb = Pick<Prisma.TransactionClient, "session">;
function cookieName(request: Request) {
  return `${accountSecureCookies(request) ? "__Secure-" : ""}next-auth.session-token`;
}
export function accountSessionCookie(
  session: Pick<Session, "sessionToken" | "expires">,
  request: Request,
): string {
  return `${cookieName(request)}=${session.sessionToken}; Path=/; HttpOnly${accountSecureCookies(request) ? "; Secure" : ""}; SameSite=Lax${sessionPersistence(session.sessionToken) === "persistent" ? `; Expires=${session.expires.toUTCString()}` : ""}`;
}
export function clearAccountSessionCookie(request: Request): string {
  return `${cookieName(request)}=; Path=/; Max-Age=0; HttpOnly${accountSecureCookies(request) ? "; Secure" : ""}; SameSite=Lax`;
}
export function clearAccountSessionChunks(
  response: Response,
  request: Request,
): void {
  const prefix = `${cookieName(request)}.`;
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const name = part.slice(0, part.indexOf("=")).trim();
    if (name.startsWith(prefix) && /^\d{1,2}$/.test(name.slice(prefix.length)))
      response.headers.append(
        "Set-Cookie",
        `${name}=; Path=/; Max-Age=0; HttpOnly${accountSecureCookies(request) ? "; Secure" : ""}; SameSite=Lax`,
      );
  }
}
export async function createAccountSession(
  userId: string,
  remember: boolean,
  request: Request,
  db: SessionDb = prisma,
) {
  const now = new Date();
  const session = await db.session.create({
    data: {
      userId,
      sessionToken: createSessionToken(remember),
      expires: new Date(
        now.getTime() +
          (remember ? REMEMBERED_SESSION_SECONDS : BROWSER_SESSION_SECONDS) *
            1000,
      ),
      createdAt: now,
      lastActiveAt: now,
      userAgent:
        request.headers
          .get("user-agent")
          ?.replace(/[\x00-\x1f\x7f]/g, "")
          .slice(0, 512) || null,
    },
  });
  return { session, cookie: accountSessionCookie(session, request) };
}
export async function getCurrentAccountSession(
  request: Request,
): Promise<CurrentAccountSession | null> {
  const token = accountSessionToken(request);
  if (!token || token.length > 512) return null;
  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
  });
  if (!session || session.expires.getTime() <= Date.now()) return null;
  return session;
}
