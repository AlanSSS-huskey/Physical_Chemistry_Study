import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";

function mustGetEnv(name: string, fallback?: string) {
  const val = process.env[name] ?? fallback;
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    GoogleProvider({
      clientId: mustGetEnv("GOOGLE_CLIENT_ID", process.env.AUTH_GOOGLE_ID),
      clientSecret: mustGetEnv("GOOGLE_CLIENT_SECRET", process.env.AUTH_GOOGLE_SECRET)
    })
  ],
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        // expose user id to server actions/pages
        (session.user as { id?: string }).id = user.id;
      }
      return session;
    }
  }
};

export function getSession() {
  return getServerSession(authOptions);
}

