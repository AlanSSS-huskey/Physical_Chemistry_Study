"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export function AuthNav() {
  const { data, status } = useSession();
  const user = data?.user;

  if (status === "loading") {
    return <div className="text-sm text-zinc-500">Loading…</div>;
  }

  if (!user) {
    return (
      <button
        onClick={() => signIn("google")}
        className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
      >
        Sign in
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-sm text-zinc-700">{user.email ?? user.name}</div>
      <button
        onClick={() => signOut()}
        className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
      >
        Sign out
      </button>
    </div>
  );
}

