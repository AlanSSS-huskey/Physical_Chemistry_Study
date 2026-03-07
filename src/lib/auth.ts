import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID ?? "";
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET ?? process.env.AUTH_GOOGLE_SECRET ?? "";
  const disabled = process.env.DISABLE_GOOGLE_LOGIN === "true";
  return {
    clientId,
    clientSecret,
    disabled,
    configured: !disabled && Boolean(clientId && clientSecret)
  };
}

export function getAuthSecret() {
  return process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "";
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getAuthOptions(): NextAuthOptions {
  const google = getGoogleOAuthConfig();
  const useDbSession = isDatabaseConfigured();

  return {
    ...(useDbSession
      ? {
          adapter: PrismaAdapter(prisma),
          session: { strategy: "database" as const }
        }
      : {
          session: { strategy: "jwt" as const }
        }),
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
      async session({ session, user, token }) {
        if (session.user) {
          session.user.id = user?.id ?? token?.sub ?? "";
        }
        return session;
      }
    }
  };
}

export async function getSession() {
  try {
    return await getServerSession(getAuthOptions());
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("getSession failed:", error);
    }
    return null;
  }
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}
