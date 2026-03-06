"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

export function AuthNav({ authConfigured = false }: { authConfigured?: boolean }) {
  const { data, status } = useSession();
  const user = data?.user;
  const pathname = usePathname();

  if (status === "loading") {
    return <div className="text-sm text-slate-500">正在加载...</div>;
  }

  if (!user) {
    if (!authConfigured) {
      return <span className="text-sm text-slate-400">登录（待配置）</span>;
    }
    return (
      <button
        onClick={() =>
          signIn("google", {
            callbackUrl: pathname || "/"
          })
        }
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700"
      >
        登录
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-sm text-slate-600">{user.email ?? user.name}</div>
      <button
        onClick={() => signOut()}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-rose-300 hover:text-rose-700"
      >
        退出
      </button>
    </div>
  );
}
