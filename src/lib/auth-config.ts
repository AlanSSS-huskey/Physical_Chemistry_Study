/** Configuration and boundary validation with no framework or database imports. */
type Environment = Record<string, string | undefined>;

export function hasValidDatabaseUrl(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value.trim());
    return (
      (url.protocol === "postgresql:" || url.protocol === "postgres:") &&
      Boolean(url.hostname && url.pathname.length > 1)
    );
  } catch {
    return false;
  }
}

export function authConfiguration(env: Environment): {
  status: "ready" | "unconfigured";
} {
  const googleId = env.GOOGLE_CLIENT_ID?.trim() || env.AUTH_GOOGLE_ID?.trim();
  const googleSecret =
    env.GOOGLE_CLIENT_SECRET?.trim() || env.AUTH_GOOGLE_SECRET?.trim();
  const secret = env.NEXTAUTH_SECRET?.trim() || env.AUTH_SECRET?.trim();
  return {
    status:
      env.DISABLE_GOOGLE_LOGIN !== "true" &&
      googleId &&
      googleSecret &&
      secret &&
      hasValidDatabaseUrl(env.DATABASE_URL)
        ? "ready"
        : "unconfigured",
  };
}

export function hasSessionCookie(
  cookies: ReadonlyArray<{ name: string; value: string }>,
): boolean {
  return cookies.some(
    ({ name, value }) =>
      /^(?:__Secure-)?next-auth\.session-token(?:\.\d+)?$/.test(name) &&
      Boolean(value),
  );
}

export function safeCallbackPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) return "/account";
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return "/account";
  }
  if (
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    /[\\\r\n\x00]/.test(decoded)
  )
    return "/account";
  const callbackOrigin = "https://callback.invalid";
  const normalized = new URL(value, callbackOrigin);
  const decodedPathname = decodeURIComponent(normalized.pathname);
  // Dot-segment normalization can turn an internal path into //another-host.
  if (
    normalized.origin !== callbackOrigin ||
    normalized.pathname.startsWith("//") ||
    decodedPathname.startsWith("//") ||
    decodedPathname.replace(/\/+$/, "") === "/login" ||
    decodedPathname.startsWith("/api/auth")
  )
    return "/account";
  return `${normalized.pathname}${normalized.search}${normalized.hash}`;
}

export class AuthenticationUnavailableError extends Error {
  readonly kind: "unconfigured" | "unavailable";
  readonly status = 503;

  constructor(kind: "unconfigured" | "unavailable" = "unavailable") {
    super("Authentication is temporarily unavailable.");
    this.name = "AuthenticationUnavailableError";
    this.kind = kind;
  }
}

/** NextAuth can log adapter errors and return null; preserve that failure state. */
export async function resolveDatabaseSession<T>(dependencies: {
  hasSession: boolean;
  configured: boolean;
  read: () => Promise<{ session: T | null; failed: boolean }>;
}): Promise<T | null> {
  if (!dependencies.hasSession) return null;
  if (!dependencies.configured)
    throw new AuthenticationUnavailableError("unconfigured");
  try {
    const result = await dependencies.read();
    if (result.failed) throw new AuthenticationUnavailableError();
    return result.session;
  } catch {
    throw new AuthenticationUnavailableError();
  }
}
