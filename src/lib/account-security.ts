import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export class AccountError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryAfter?: number;
  readonly fields?: Record<string, string>;
  constructor(
    code: string,
    status = 400,
    retryAfter?: number,
    fields?: Record<string, string>,
  ) {
    super(code);
    this.name = "AccountError";
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
    this.fields = fields;
  }
}
export function accountFailure(error: unknown): Response {
  const known =
    error instanceof AccountError
      ? error
      : new AccountError("UNAVAILABLE", 503);
  return Response.json(
    {
      ok: false,
      code: known.code,
      ...(known.retryAfter ? { retryAfter: known.retryAfter } : {}),
      ...(known.fields ? { fields: known.fields } : {}),
    },
    {
      status: known.status,
      headers: {
        "Cache-Control": "no-store",
        ...(known.retryAfter
          ? { "Retry-After": String(known.retryAfter) }
          : {}),
      },
    },
  );
}
export function accountSecret(): string {
  const secret =
    process.env.NEXTAUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (!secret) throw new AccountError("UNAVAILABLE", 503);
  return secret;
}
export function accountRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const protocol =
    request.headers.get("x-forwarded-proto") || url.protocol.slice(0, -1);
  const host = request.headers.get("host") || url.host;
  if (
    !["http", "https"].includes(protocol) ||
    !/^[a-z0-9.[\]:-]{1,300}$/i.test(host)
  )
    throw new AccountError("FORBIDDEN", 403);
  return new URL(`${protocol}://${host}`).origin;
}
export function accountSecureCookies(request: Request): boolean {
  return accountRequestOrigin(request).startsWith("https:");
}
export function accountCookie(
  request: Request,
  name: string,
): string | undefined {
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const split = part.indexOf("=");
    if (part.slice(0, split).trim() === name)
      return part.slice(split + 1).trim();
  }
}
export function accountSessionToken(request: Request): string | null {
  const name = `${accountSecureCookies(request) ? "__Secure-" : ""}next-auth.session-token`;
  const direct = accountCookie(request, name);
  if (direct) return direct;
  const chunks = new Map<number, string>();
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const equal = part.indexOf("=");
    const key = part.slice(0, equal).trim();
    if (!key.startsWith(`${name}.`)) continue;
    const suffix = key.slice(name.length + 1);
    if (!/^\d{1,2}$/.test(suffix)) continue;
    chunks.set(Number(suffix), part.slice(equal + 1).trim());
  }
  if (!chunks.size || chunks.size > 16) return null;
  let token = "";
  for (let index = 0; index < chunks.size; index++) {
    const chunk = chunks.get(index);
    if (!chunk) return null;
    token += chunk;
  }
  return token.length <= 512 ? token : null;
}
function csrfName(request: Request) {
  return `${accountSecureCookies(request) ? "__Host-" : ""}chemistry.account-csrf`;
}
function signature(value: string): string {
  return createHmac("sha256", accountSecret())
    .update(`account-csrf-v1:${value}`)
    .digest("base64url");
}
function equal(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function validCsrfCookie(value: string | undefined): string | null {
  if (!value || value.length > 200) return null;
  const [nonce, expires, signed, extra] = value.split(".");
  if (
    extra ||
    !/^[A-Za-z0-9_-]{43}$/.test(nonce || "") ||
    !/^\d{10}$/.test(expires || "") ||
    Number(expires) <= Date.now() / 1000 ||
    !/^[A-Za-z0-9_-]{43}$/.test(signed || "")
  )
    return null;
  return equal(signature(`${nonce}.${expires}`), signed) ? nonce : null;
}
export function accountCsrfResponse(request: Request): Response {
  const existing = accountCookie(request, csrfName(request));
  const valid = validCsrfCookie(existing);
  const nonce = valid || randomBytes(32).toString("base64url");
  const payload = `${nonce}.${Math.floor(Date.now() / 1000) + 86400}`;
  const value = valid ? existing! : `${payload}.${signature(payload)}`;
  return Response.json(
    { csrfToken: nonce },
    {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": `${csrfName(request)}=${value}; Path=/; Max-Age=86400; HttpOnly${accountSecureCookies(request) ? "; Secure" : ""}; SameSite=Lax`,
      },
    },
  );
}
export function assertAccountMutation(request: Request): void {
  if (
    request.headers.get("origin") !== accountRequestOrigin(request) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new AccountError("FORBIDDEN", 403);
  const valid = validCsrfCookie(accountCookie(request, csrfName(request)));
  const supplied = request.headers.get("x-csrf-token");
  if (!valid || !supplied || !equal(valid, supplied))
    throw new AccountError("CSRF_INVALID", 403);
}
export async function getAccountMutation(
  request: Request,
): Promise<Record<string, unknown>> {
  assertAccountMutation(request);
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AccountError("VALIDATION_ERROR", 400);
  const reader = request.body?.getReader();
  if (!reader) throw new AccountError("VALIDATION_ERROR", 400);
  let body = "";
  let size = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        throw new AccountError("VALIDATION_ERROR", 413);
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new AccountError("VALIDATION_ERROR", 400);
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AccountError) throw error;
    throw new AccountError("VALIDATION_ERROR", 400);
  } finally {
    reader.releaseLock();
  }
}
export function normalizeAccountEmail(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 254 ||
    /[\r\n\x00-\x20]/.test(value.trim())
  )
    throw new AccountError("VALIDATION_ERROR", 400, undefined, {
      email: "INVALID_EMAIL",
    });
  const email = value.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    throw new AccountError("VALIDATION_ERROR", 400, undefined, {
      email: "INVALID_EMAIL",
    });
  return email;
}
export function validatePassword(value: unknown): string {
  if (
    typeof value !== "string" ||
    [...value].length < 12 ||
    [...value].length > 128 ||
    value.includes("\0")
  )
    throw new AccountError("VALIDATION_ERROR", 400, undefined, {
      password: "PASSWORD_LENGTH",
    });
  return value;
}
export function validateAccountName(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    [...value.trim()].length > 80 ||
    /[\x00-\x1f\x7f]/.test(value)
  )
    throw new AccountError("VALIDATION_ERROR", 400, undefined, {
      name: "INVALID_NAME",
    });
  return value.trim();
}
