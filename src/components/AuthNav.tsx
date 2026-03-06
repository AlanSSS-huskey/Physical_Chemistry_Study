"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

export function AuthNav({ authConfigured = false }: { authConfigured?: boolean }) {
  const { data, status } = useSession();
  const user = data?.user;
  const pathname = usePathname();

  if (status === "loading") {
    return <div className="text-sm text-zinc-500">正在加载...</div>;
  }

  if (!user) {
    if (!authConfigured) {
      return <span className="text-sm text-zinc-400">登录（待配置）</span>;
    }
    return (
      <button
        onClick={() =>
          signIn("google", {
            callbackUrl: pathname || "/"
          })
        }
        className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
      >
        登录
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
        退出
      </button>
    </div>
  );
}
