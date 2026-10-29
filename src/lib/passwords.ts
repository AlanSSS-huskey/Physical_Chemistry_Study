import { randomBytes, createHash, scrypt, timingSafeEqual } from "node:crypto";
const N = 131072;
const r = 8;
const p = 1;
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N, r, p, maxmem: 256 * 1024 * 1024 },
      (error, hash) => (error ? reject(error) : resolve(hash)),
    ),
  );
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}
export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const parts = encoded.split("$");
  if (
    parts.length !== 6 ||
    parts[0] !== "scrypt" ||
    parts[1] !== String(N) ||
    parts[2] !== String(r) ||
    parts[3] !== String(p) ||
    !/^[A-Za-z0-9_-]{22}$/.test(parts[4]) ||
    !/^[A-Za-z0-9_-]{86}$/.test(parts[5])
  )
    return false;
  const hash = await derive(password, Buffer.from(parts[4], "base64url"));
  const expected = Buffer.from(parts[5], "base64url");
  return expected.length === hash.length && timingSafeEqual(expected, hash);
}
export function createEmailToken(): string {
  return randomBytes(32).toString("base64url");
}
export function hashEmailToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export function maskAccountEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}
