/** Configuration and boundary validation with no framework or database imports. */
type Environment = Record<string, string | undefined>;

/** Opt in only after registering this stable preview's exact callback in Google. */
export function googlePreviewPolicy(
  env: Environment,
  requestOrigin?: string,
): { allowed: boolean } {
  if (env.VERCEL_ENV !== "preview") return { allowed: true };
  try {
    const preview = new URL(env.GOOGLE_PREVIEW_ORIGIN || "");
    const canonical = new URL(env.NEXTAUTH_URL || "");
    return {
      allowed:
        (!requestOrigin || new URL(requestOrigin).origin === preview.origin) &&
        preview.protocol === "https:" &&
        !preview.username &&
        !preview.password &&
        preview.pathname === "/" &&
        !preview.search &&
        !preview.hash &&
        canonical.origin === preview.origin &&
        canonical.pathname === "/" &&
        !canonical.username &&
        !canonical.password &&
        !canonical.search &&
        !canonical.hash,
    };
  } catch {
    return { allowed: false };
  }
}

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
  const secret = env.NEXTAUTH_SECRET?.trim() || env.AUTH_SECRET?.trim();
  return {
    status:
      secret && hasValidDatabaseUrl(env.DATABASE_URL)
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
