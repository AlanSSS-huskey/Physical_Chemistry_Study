import NextAuth from "next-auth";
import { getAuthOptions, getGoogleOAuthConfig, isDatabaseConfigured } from "@/lib/auth";

function missingConfigResponse() {
  const authSecretConfigured = Boolean(process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET);
  const databaseConfigured = isDatabaseConfigured();

  return new Response(
    [
      "Auth is not configured.",
      "Set env vars:",
      databaseConfigured
        ? "- DATABASE_URL is configured"
        : "- DATABASE_URL",
      "- GOOGLE_CLIENT_ID (or AUTH_GOOGLE_ID)",
      "- GOOGLE_CLIENT_SECRET (or AUTH_GOOGLE_SECRET)",
      authSecretConfigured
        ? "- NEXTAUTH_SECRET is configured"
        : "- NEXTAUTH_SECRET (or AUTH_SECRET) is strongly recommended",
      "- NEXTAUTH_URL"
    ].join("\n"),
    { status: 500 }
  );
}

const nextAuthHandler = NextAuth(getAuthOptions());

function ensureAuthConfigured() {
  const google = getGoogleOAuthConfig();
  return google.configured && isDatabaseConfigured();
}

export async function GET(req: Request) {
  if (!ensureAuthConfigured()) return missingConfigResponse();
  return nextAuthHandler(req);
}

export async function POST(req: Request) {
  if (!ensureAuthConfigured()) return missingConfigResponse();
  return nextAuthHandler(req);
}
