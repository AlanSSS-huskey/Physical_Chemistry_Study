import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { AsyncLocalStorage } from "node:async_hooks";
import type { NextAuthOptions, Session } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  AuthenticationUnavailableError,
  authConfiguration,
  hasSessionCookie,
  hasValidDatabaseUrl,
  resolveDatabaseSession,
} from "@/lib/auth-config";
import {
  createSessionPolicyAdapter,
  createSessionToken,
  REMEMBERED_SESSION_SECONDS,
  type ObservedSession,
} from "@/lib/session-policy";

export { AuthenticationUnavailableError } from "@/lib/auth-config";

const authFailureContext = new AsyncLocalStorage<{ failed: boolean }>();

/** NextAuth 4's logger is global; use request-local state for error detection. */
export async function trackAuthOperation<T>(
  operation: () => Promise<T>,
): Promise<{ result: T; failed: boolean }> {
  const state = { failed: false };
  return authFailureContext.run(state, async () => ({
    result: await operation(),
    failed: state.failed,
  }));
}

export function getGoogleOAuthConfig() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    process.env.AUTH_GOOGLE_ID?.trim() ||
    "";
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET?.trim() ||
    process.env.AUTH_GOOGLE_SECRET?.trim() ||
    "";
  const disabled = process.env.DISABLE_GOOGLE_LOGIN === "true";
  return {
    clientId,
    clientSecret,
    disabled,
    configured: !disabled && Boolean(clientId && clientSecret),
  };
}

export function getAuthSecret() {
  return (
    process.env.NEXTAUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim() || ""
  );
}

export function isDatabaseConfigured() {
  return hasValidDatabaseUrl(process.env.DATABASE_URL);
}

export function getAuthAvailability() {
  return authConfiguration(process.env);
}

/** Never log adapter messages, query data, credentials or stack traces. */
export function logAuthFailure(context: string, error?: unknown) {
  const code =
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    /^P\d{4}$/.test(error.code)
      ? error.code
      : undefined;
  console.error("[auth] Service unavailable", {
    context,
    ...(code ? { code } : {}),
  });
}

export function getAuthOptions(policy?: {
  remember: boolean;
  observe?: (session: ObservedSession) => void;
}): NextAuthOptions {
  const google = getGoogleOAuthConfig();
  return {
    adapter: createSessionPolicyAdapter(PrismaAdapter(prisma), {
      observe: policy?.observe,
    }),
    session: {
      strategy: "database",
      maxAge: REMEMBERED_SESSION_SECONDS,
      updateAge: REMEMBERED_SESSION_SECONDS,
      generateSessionToken: () => createSessionToken(policy?.remember === true),
    },
    providers: google.configured
      ? [
          GoogleProvider({
            clientId: google.clientId,
            clientSecret: google.clientSecret,
          }),
        ]
      : [],
    secret: getAuthSecret() || undefined,
    pages: { signIn: "/login", error: "/login" },
    logger: {
      error(code) {
        const state = authFailureContext.getStore();
        if (state) state.failed = true;
        logAuthFailure(/^[A-Z_]{1,64}$/.test(code) ? code : "NEXTAUTH_ERROR");
      },
      warn(code) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[auth] Configuration warning", {
            code: /^[A-Z_]{1,64}$/.test(code) ? code : "NEXTAUTH_WARNING",
          });
        }
      },
    },
    callbacks: {
      async session({ session, user }) {
        if (session.user) session.user.id = user.id;
        return session;
      },
    },
  };
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  return resolveDatabaseSession({
    hasSession: hasSessionCookie(cookieStore.getAll()),
    configured: getAuthAvailability().status === "ready",
    async read() {
      try {
        const { result: session, failed } = await trackAuthOperation(() =>
          getServerSession(getAuthOptions()),
        );
        return { session, failed };
      } catch (error) {
        logAuthFailure("SESSION_LOOKUP", error);
        throw error;
      }
    },
  });
}

export type SessionState =
  | { status: "authenticated"; user: NonNullable<Session["user"]> }
  | { status: "anonymous" | "unconfigured" | "unavailable"; user?: never };

export async function getSessionState(): Promise<SessionState> {
  try {
    const session = await getSession();
    if (session?.user?.id)
      return { status: "authenticated", user: session.user };
    return {
      status:
        getAuthAvailability().status === "ready" ? "anonymous" : "unconfigured",
    };
  } catch (error) {
    unstable_rethrow(error);
    if (!(error instanceof AuthenticationUnavailableError))
      logAuthFailure("SESSION_STATE", error);
    return {
      status:
        error instanceof AuthenticationUnavailableError
          ? error.kind
          : "unavailable",
    };
  }
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}
