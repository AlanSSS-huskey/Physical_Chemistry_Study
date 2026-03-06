import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getAuthSecret } from "@/lib/auth";

const ADMIN_COOKIE_NAME = "admin_session";
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;

function getAdminPassword(): string {
  return process.env.ADMIN_PAGE_PASSWORD?.trim() ?? "";
}

function getAdminCookieSecret(): string {
  return process.env.ADMIN_COOKIE_SECRET?.trim() || getAuthSecret();
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function signPayload(payload: string): string {
  const secret = getAdminCookieSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function serializeSession(userId: string, expiresAt: number): string {
  const payload = `${userId}:${expiresAt}`;
  const signature = signPayload(payload);
  return Buffer.from(`${payload}:${signature}`, "utf8").toString("base64url");
}

function parseSession(raw: string): { userId: string; expiresAt: number; signature: string } | null {
  let decoded = "";
  try {
    decoded = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const [userId, expiresAtRaw, signature] = decoded.split(":");
  const expiresAt = Number.parseInt(expiresAtRaw ?? "", 10);
  if (!userId || !signature || !Number.isFinite(expiresAt)) {
    return null;
  }
  return { userId, expiresAt, signature };
}

export function isAdminPasswordConfigured(): boolean {
  return getAdminPassword().length > 0;
}

export function verifyAdminPassword(input: string): boolean {
  const expected = getAdminPassword();
  const candidate = input.trim();
  if (!expected || !candidate) return false;
  return constantTimeEqual(candidate, expected);
}

export async function createAdminSession(userId: string): Promise<void> {
  const cookieStore = await cookies();
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000;
  const value = serializeSession(userId, expiresAt);

  cookieStore.set(ADMIN_COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}

export async function hasAdminSession(userId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!raw) return false;

  const parsed = parseSession(raw);
  if (!parsed) return false;
  if (parsed.userId !== userId) return false;
  if (parsed.expiresAt <= Date.now()) return false;

  const payload = `${parsed.userId}:${parsed.expiresAt}`;
  const expectedSignature = signPayload(payload);
  if (!expectedSignature) return false;

  return constantTimeEqual(parsed.signature, expectedSignature);
}
