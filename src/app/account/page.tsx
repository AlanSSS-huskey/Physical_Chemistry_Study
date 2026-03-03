import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function AccountPage() {
  const session = await getSession();
  const user = session?.user as { id?: string; email?: string | null; name?: string | null } | undefined;

  if (!user?.id) {
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

