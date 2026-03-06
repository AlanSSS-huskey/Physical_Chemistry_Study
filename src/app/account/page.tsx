import { redirect } from "next/navigation";
import { getCurrentUser, getGoogleOAuthConfig } from "@/lib/auth";

export default async function AccountPage() {
  const authConfigured = getGoogleOAuthConfig().configured;
  if (!authConfigured) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
          <p className="text-sm text-zinc-700">登录功能待配置。配置 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 后即可使用 Google 登录。</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          预留结构已就绪，详见 README 中的「Google OAuth 配置」说明。
        </div>
      </div>
    );
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/api/auth/signin");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-zinc-700">登录后可看到个人信息与学习进度（最简版）。</p>
      </div>

      <div className="rounded-lg border p-4">
        <div className="text-sm text-zinc-700">User ID</div>
        <div className="mt-1 font-mono text-sm">{user.id}</div>
        <div className="mt-4 text-sm text-zinc-700">Email</div>
        <div className="mt-1 text-sm">{user.email ?? "—"}</div>
        <div className="mt-4 text-sm text-zinc-700">Name</div>
        <div className="mt-1 text-sm">{user.name ?? "—"}</div>
      </div>
    </div>
  );
}
