import NextAuth from "next-auth";
import { getAuthOptions, getGoogleOAuthConfig, isDatabaseConfigured } from "@/lib/auth";

function missingConfigResponse() {
  const authSecretConfigured = Boolean(process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET);
  const databaseConfigured = isDatabaseConfigured();

  return new Response(
    [
      "Auth is not configured.",
      "Set env vars:",
      "- GOOGLE_CLIENT_ID (or AUTH_GOOGLE_ID)",
      "- GOOGLE_CLIENT_SECRET (or AUTH_GOOGLE_SECRET)",
      databaseConfigured
        ? "- DATABASE_URL is configured (optional if using JWT session fallback)"
        : "- DATABASE_URL is optional (JWT session fallback is used when missing)",
      authSecretConfigured
        ? "- NEXTAUTH_SECRET is configured"
        : "- NEXTAUTH_SECRET (or AUTH_SECRET) is required in production",
      "- NEXTAUTH_URL"
    ].join("\n"),
    { status: 500 }
  );
}

function isSecretConfigured() {
  return Boolean(process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET);
}

function ensureAuthConfigured() {
  const google = getGoogleOAuthConfig();
  const requireSecret = process.env.NODE_ENV === "production";
  if (!google.configured) return false;
  if (requireSecret && !isSecretConfigured()) return false;
  return true;
}

export async function GET(req: Request) {
  if (!ensureAuthConfigured()) return missingConfigResponse();
  try {
    const nextAuthHandler = NextAuth(getAuthOptions());
    return nextAuthHandler(req);
  } catch (error) {
    console.error("Auth GET route failed:", error);
    return new Response("Auth route internal error.", { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!ensureAuthConfigured()) return missingConfigResponse();
  try {
    const nextAuthHandler = NextAuth(getAuthOptions());
    return nextAuthHandler(req);
  } catch (error) {
    console.error("Auth POST route failed:", error);
    return new Response("Auth route internal error.", { status: 500 });
  }
}
