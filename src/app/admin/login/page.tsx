import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasAdminSession, isAdminPasswordConfigured } from "@/lib/admin";
import { loginAdmin } from "@/app/admin/login/actions";

type Props = {
  searchParams?: Promise<{ error?: string }>;
};

function getErrorMessage(error?: string): string | null {
  if (error === "invalid") return "密码错误，请重试。";
  if (error === "config") return "管理员密码未配置，请先在 .env 设置 ADMIN_PAGE_PASSWORD。";
  return null;
}

export default async function AdminLoginPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/api/auth/signin?callbackUrl=/admin/login");
  }

  if (await hasAdminSession(user.id)) {
    redirect("/admin");
  }

  const params = await searchParams;
  const error = getErrorMessage(params?.error);
  const configured = isAdminPasswordConfigured();

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-700 bg-gradient-to-r from-amber-600 to-amber-500 p-8 text-white">
          <h1 className="text-2xl font-black tracking-tight">Admin Access</h1>
          <p className="mt-1 text-sm text-amber-100">
            当前账号：{user.email ?? user.name ?? user.id}
          </p>
        </div>

        <div className="space-y-4 p-6">
          {!configured && (
            <div className="rounded-lg border border-amber-300/40 bg-amber-500/10 p-3 text-sm text-amber-200">
              未检测到 `ADMIN_PAGE_PASSWORD`，请先配置环境变量后重启应用。
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-300/50 bg-rose-500/10 p-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          <form action={loginAdmin} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Admin 密码</span>
              <input
                type="password"
                name="password"
                required
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-offset-2 ring-offset-slate-900 focus:ring-2 focus:ring-amber-400"
                placeholder="输入管理员密码"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-black text-slate-900 hover:bg-amber-400"
            >
              进入 Admin
            </button>
          </form>

          <div className="pt-1 text-sm">
            <Link href="/account" className="text-slate-400 underline underline-offset-4 hover:text-white">
              返回账户页
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
