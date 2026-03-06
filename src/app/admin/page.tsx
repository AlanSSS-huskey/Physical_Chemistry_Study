import fs from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasAdminSession } from "@/lib/admin";
import { logoutAdmin, saveAdminNotes } from "@/app/admin/actions";

const ADMIN_CONTENT_FILE = path.join(process.cwd(), "content", "admin", "notes.md");

async function readAdminNotes(): Promise<string> {
  try {
    return await fs.readFile(ADMIN_CONTENT_FILE, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

type Props = {
  searchParams?: Promise<{ saved?: string }>;
};

export default async function AdminPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/api/auth/signin?callbackUrl=/admin");
  }

  if (!(await hasAdminSession(user.id))) {
    redirect("/admin/login");
  }

  const [content, params] = await Promise.all([readAdminNotes(), searchParams]);
  const saved = params?.saved === "1";
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-black uppercase tracking-wider text-amber-600">Admin Workspace</div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Content Editor</h1>
            <p className="text-sm text-slate-600">直接编辑后台草稿，并保存到本地内容目录。</p>
          </div>
          <form action={logoutAdmin}>
            <button
              type="submit"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-rose-300 hover:text-rose-700"
            >
              退出 Admin
            </button>
          </form>
        </div>
      </header>

      {saved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
          已保存。
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Overview</h2>
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-2xl font-black text-slate-900">{wordCount}</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Words</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-2xl font-black text-blue-700">{content.length}</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Characters</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            文件：`content/admin/notes.md`
          </div>
        </aside>

        <form action={saveAdminNotes} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <textarea
            name="content"
            defaultValue={content}
            className="min-h-[65vh] w-full rounded-xl border border-slate-300 bg-slate-50 p-4 font-mono text-sm text-slate-800 outline-none ring-offset-2 focus:ring-2 focus:ring-blue-300"
            placeholder="在这里写内容..."
          />
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
          >
            保存内容
          </button>
        </form>
      </div>

    </div>
  );
}
