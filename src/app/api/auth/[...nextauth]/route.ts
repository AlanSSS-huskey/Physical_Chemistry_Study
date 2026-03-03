import NextAuth from "next-auth/next";
import { getAuthOptions, getGoogleOAuthConfig } from "@/lib/auth";

function missingConfigResponse() {
  return new Response(
    [
      "Auth is not configured.",
      "Set env vars:",
      "- GOOGLE_CLIENT_ID",
      "- GOOGLE_CLIENT_SECRET",
      "- NEXTAUTH_SECRET (recommended for production)",
      "- NEXTAUTH_URL"
    ].join("\n"),
    { status: 500 }
  );
}

export async function GET(req: Request) {
  const google = getGoogleOAuthConfig();
  if (!google.configured) return missingConfigResponse();
  return NextAuth(getAuthOptions())(req);
}

export async function POST(req: Request) {
  const google = getGoogleOAuthConfig();
  if (!google.configured) return missingConfigResponse();
  return NextAuth(getAuthOptions())(req);
}

