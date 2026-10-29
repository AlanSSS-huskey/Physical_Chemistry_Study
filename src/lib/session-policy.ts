import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { Adapter, AdapterSession } from "next-auth/adapters";

export const REMEMBERED_SESSION_SECONDS = 30 * 86400;
export const BROWSER_SESSION_SECONDS = 12 * 3600;
const LOGIN_PREFERENCE_SECONDS = 15 * 60;
const policyToken = /^([rs])\.[A-Za-z0-9_-]{43}$/;

/** Policy belongs to this opaque database token; changing it breaks the lookup. */
export function createSessionToken(remember: boolean): string {
  return `${remember ? "r" : "s"}.${randomBytes(32).toString("base64url")}`;
}

export function sessionPersistence(token: string): "persistent" | "browser" {
  return policyToken.exec(token)?.[1] === "s" ? "browser" : "persistent";
}

function preferenceSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`chemistry-login-preference-v1:${payload}`)
    .digest("base64url");
}

function stateDigest(state: string): string {
  return createHash("sha256").update(state).digest("base64url");
}

/** Only issued after NextAuth accepted CSRF and created an OAuth state. */
export function signLoginPreference(
  remember: boolean,
  state: string,
  secret: string,
  now = Date.now(),
): string {
  if (!secret || !state || state.length > 2048) return "";
  const expires = Math.floor(now / 1000) + LOGIN_PREFERENCE_SECONDS;
  const payload = `1.${remember ? "r" : "s"}.${expires}.${stateDigest(state)}`;
  return `${payload}.${preferenceSignature(payload, secret)}`;
}

export function readLoginPreference(
  value: string | undefined,
  state: string,
  secret: string,
  now = Date.now(),
): boolean {
  if (!value || !state || !secret || value.length > 256 || state.length > 2048)
    return false;
  const parts = value.split(".");
  if (
    parts.length !== 5 ||
    parts[0] !== "1" ||
    !/^[rs]$/.test(parts[1]) ||
    !/^\d{10}$/.test(parts[2]) ||
    Number(parts[2]) <= Math.floor(now / 1000) ||
    Number(parts[2]) > Math.floor(now / 1000) + LOGIN_PREFERENCE_SECONDS ||
    parts[3] !== stateDigest(state) ||
    !/^[A-Za-z0-9_-]{43}$/.test(parts[4])
  )
    return false;
  const expected = Buffer.from(
    preferenceSignature(parts.slice(0, 4).join("."), secret),
  );
  const supplied = Buffer.from(parts[4]);
  return timingSafeEqual(expected, supplied) && parts[1] === "r";
}

export function loginPreferenceCookieName(secure: boolean): string {
  return `${secure ? "__Host-" : ""}chemistry.login-preference`;
}

export function loginPreferenceCookie(value: string, secure: boolean): string {
  return `${loginPreferenceCookieName(secure)}=${encodeURIComponent(value)}; Path=/; Max-Age=${value ? LOGIN_PREFERENCE_SECONDS : 0}; HttpOnly${secure ? "; Secure" : ""}; SameSite=Lax`;
}

export function withLoginPreferenceCookie(
  response: Response,
  value: string,
  secure: boolean,
): Response {
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", loginPreferenceCookie(value, secure));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function readRequestedRemember(
  request: Request,
): Promise<boolean> {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (
      !contentType.includes("application/x-www-form-urlencoded") &&
      !contentType.includes("application/json")
    )
      return false;
    if (Number(request.headers.get("content-length")) > 16_384) return false;
    const reader = request.clone().body?.getReader();
    if (!reader) return false;
    const decoder = new TextDecoder();
    let bytes = 0;
    let body = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 16_384) {
        // A cloned request uses a tee; awaiting cancellation would wait for the
        // original NextAuth request body to be consumed too.
        void reader.cancel().catch(() => {});
        return false;
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    if (contentType.includes("application/x-www-form-urlencoded"))
      return new URLSearchParams(body).get("remember") === "true";
    if (contentType.includes("application/json"))
      return JSON.parse(body)?.remember === "true";
  } catch {
    // A malformed or absent preference always chooses the shorter session.
  }
  return false;
}

/** NextAuth React signIn returns JSON {url}; direct forms receive Location. */
export async function googleOAuthState(
  response: Response,
): Promise<string | null> {
  try {
    let destination = response.headers.get("Location");
    if (
      !destination &&
      response.headers.get("Content-Type")?.includes("application/json")
    ) {
      const body: unknown = await response.clone().json();
      if (
        body &&
        typeof body === "object" &&
        "url" in body &&
        typeof body.url === "string"
      )
        destination = body.url;
    }
    if (!destination) return null;
    const url = new URL(destination);
    const state = url.searchParams.get("state");
    return url.protocol === "https:" &&
      url.hostname === "accounts.google.com" &&
      url.pathname.startsWith("/o/oauth2/") &&
      state &&
      state.length <= 2048
      ? state
      : null;
  } catch {
    return null;
  }
}

export type ObservedSession = Pick<AdapterSession, "sessionToken" | "expires">;
type SessionActivity = {
  createdAt?: Date;
  lastActiveAt?: Date;
  userAgent?: string | null;
};
export const SESSION_ACTIVITY_INTERVAL_MS = 60_000;
function cleanUserAgent(value: string | undefined): string | null {
  return value?.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 512) || null;
}

/** Keep absolute lifetimes: NextAuth's default rolling update must not extend them. */
export function createSessionPolicyAdapter(
  adapter: Adapter,
  options: {
    now?: () => number;
    observe?: (session: ObservedSession) => void;
    userAgent?: string;
    touchSession?: (
      token: string,
      at: Date,
      userAgent?: string,
    ) => Promise<void>;
  } = {},
): Adapter {
  const now = options.now ?? Date.now;
  const create = adapter.createSession;
  const read = adapter.getSessionAndUser;
  const update = adapter.updateSession;
  const remove = adapter.deleteSession;
  if (!create || !read || !update || !remove)
    throw new Error("Database session adapter is required.");

  async function deleteSession(token: string): Promise<AdapterSession | null> {
    try {
      const deleted = await remove!(token);
      return deleted ?? null;
    } catch (error) {
      // Another tab or request may already have removed this exact session.
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2025"
      )
        return null;
      throw error;
    }
  }

  async function getSessionAndUser(token: string) {
    const record = await read!(token);
    if (!record) return null;
    const timestamp = now();
    if (record.session.expires.getTime() <= timestamp) {
      await deleteSession(token);
      return null;
    }
    const activity = record.session as AdapterSession & SessionActivity;
    const lastActive = activity.lastActiveAt?.getTime();
    if (
      options.touchSession &&
      (lastActive === undefined ||
        !Number.isFinite(lastActive) ||
        timestamp - lastActive >= SESSION_ACTIVITY_INTERVAL_MS)
    ) {
      const at = new Date(timestamp);
      const userAgent = !activity.userAgent
        ? cleanUserAgent(options.userAgent) || undefined
        : undefined;
      await options.touchSession(token, at, userAgent);
      activity.lastActiveAt = at;
      if (userAgent) activity.userAgent = userAgent;
    }
    options.observe?.(record.session);
    return record;
  }

  return {
    ...adapter,
    async createSession(data) {
      const kind = policyToken.exec(data.sessionToken)?.[1];
      const seconds =
        kind === "s" ? BROWSER_SESSION_SECONDS : REMEMBERED_SESSION_SECONDS;
      const timestamp = now();
      const dataWithActivity = {
        ...data,
        ...(kind ? { expires: new Date(timestamp + seconds * 1000) } : {}),
        createdAt: new Date(timestamp),
        lastActiveAt: new Date(timestamp),
        userAgent: cleanUserAgent(options.userAgent),
      };
      const session = await create(dataWithActivity);
      options.observe?.(session);
      return session;
    },
    getSessionAndUser,
    deleteSession,
    async updateSession(data) {
      const record = await getSessionAndUser(data.sessionToken);
      if (!record) return null;
      const session = await update({
        ...data,
        expires: record.session.expires,
      });
      if (session) options.observe?.(session);
      return session;
    },
  };
}

/** NextAuth 4 adds Expires on callback and every session GET, even for session cookies. */
export function applySessionCookiePolicy(
  response: Response,
  session?: ObservedSession,
): Response {
  const cookies = response.headers.getSetCookie();
  if (!session || !cookies.length) return response;
  const headers = new Headers(response.headers);
  headers.delete("Set-Cookie");
  for (const cookie of cookies) {
    const [pair, ...attributes] = cookie.split(/;\s*/);
    const separator = pair.indexOf("=");
    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    if (
      !/^(?:__Secure-)?next-auth\.session-token(?:\.\d+)?$/.test(name) ||
      !value ||
      attributes.some((attribute) => /^max-age=0$/i.test(attribute))
    ) {
      headers.append("Set-Cookie", cookie);
      continue;
    }
    const safeAttributes = attributes.filter(
      (attribute) => !/^(?:expires|max-age)=/i.test(attribute),
    );
    if (sessionPersistence(session.sessionToken) === "persistent")
      safeAttributes.push(`Expires=${session.expires.toUTCString()}`);
    headers.append("Set-Cookie", [pair, ...safeAttributes].join("; "));
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
