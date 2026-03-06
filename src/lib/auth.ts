import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID ?? "";
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET ?? process.env.AUTH_GOOGLE_SECRET ?? "";
  return { clientId, clientSecret, configured: Boolean(clientId && clientSecret) };
}

export function getAuthSecret() {
  return process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "";
}

export function getAuthOptions(): NextAuthOptions {
  const google = getGoogleOAuthConfig();

  return {
    adapter: PrismaAdapter(prisma),
    session: { strategy: "database" },
    providers: google.configured
      ? [
          GoogleProvider({
            clientId: google.clientId,
            clientSecret: google.clientSecret
          })
        ]
      : [],
    secret: getAuthSecret() || undefined,
    callbacks: {
      async session({ session, user }) {
        if (session.user) {
          session.user.id = user.id;
        }
        return session;
      }
    }
  };
}

export function getSession() {
  return getServerSession(getAuthOptions());
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}
