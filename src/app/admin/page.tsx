import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getGoogleOAuthConfig } from "@/lib/auth";
import { hasAdminSession } from "@/lib/admin";
import {
  createAdminChapter,
  deleteAdminChapter,
  logoutAdmin,
  saveAdminChapterRaw,
  saveAdminNotes
} from "@/app/admin/actions";
import { getNavigationTree } from "@/lib/content";

const ADMIN_CONTENT_FILE = path.join(process.cwd(), "content", "admin", "notes.md");
const CONTENT_ROOT = path.join(process.cwd(), "content");

function asSafeSlug(value: string): string {
  return /^[a-z0-9][a-z0-9-]*$/i.test(value) ? value : "";
}

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
  searchParams?: Promise<{
    saved?: string;
    deleted?: string;
    subject?: string;
    chapter?: string;
  }>;
};

export default async function AdminPage({ searchParams }: Props) {
  const authConfigured = getGoogleOAuthConfig().configured;
  const user = await getCurrentUser();
  if (authConfigured && !user) {
    redirect("/api/auth/signin?callbackUrl=/admin");
  }
  const principalId = authConfigured ? user?.id : "password-only-admin";
  if (!principalId) {
    redirect("/admin/login");
  }

  if (!(await hasAdminSession(principalId))) {
    redirect("/admin/login");
  }

  const [content, params, tree] = await Promise.all([
    readAdminNotes(),
    searchParams,
    getNavigationTree()
  ]);
  const saved = params?.saved === "1";
  const chapterSaved = params?.saved === "chapter";
  const chapterDeleted = params?.deleted === "chapter";
  const selectedSubject = asSafeSlug(params?.subject?.trim() ?? "");
  const selectedChapter = asSafeSlug(params?.chapter?.trim() ?? "");
  const selectedFile =
    selectedSubject && selectedChapter
      ? path.join(CONTENT_ROOT, selectedSubject, `${selectedChapter}.mdx`)
      : "";
  let selectedRaw = "";
  if (selectedFile) {
    try {
      selectedRaw = await fs.readFile(selectedFile, "utf8");
    } catch {
      selectedRaw = "";
    }
  }
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
      {chapterSaved && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800">
          章节内容已保存。
        </div>
      )}
      {chapterDeleted && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          章节已删除。
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

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">章节管理</h2>
          <div className="max-h-[420px] space-y-4 overflow-auto pr-1">
            {tree.subjects.map((subject) => (
              <div key={subject.slug} className="space-y-2">
                <div className="text-sm font-bold text-slate-800">{subject.title}</div>
                <div className="space-y-1">
                  {subject.chapters.map((chapter) => {
                    const href = `/admin?subject=${encodeURIComponent(subject.slug)}&chapter=${encodeURIComponent(chapter.slug)}`;
                    const active =
                      selectedSubject === subject.slug && selectedChapter === chapter.slug;
                    return (
                      <Link
                        key={`${subject.slug}/${chapter.slug}`}
                        href={href}
                        className={
                          active
                            ? "block rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800"
                            : "block rounded-lg border border-transparent px-3 py-2 text-sm text-slate-600 hover:border-slate-200 hover:bg-slate-50"
                        }
                      >
                        {chapter.title}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="space-y-6">
          <form action={createAdminChapter} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-bold text-slate-800">新增章节</div>
            <div className="grid gap-3 md:grid-cols-2">
              <input name="subject" required placeholder="subject slug (e.g. thermodynamics)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input name="chapter" required placeholder="chapter slug (e.g. intro)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input name="subjectTitle" placeholder="subject title" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input name="chapterTitle" placeholder="chapter title" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input name="moduleKey" placeholder="module key (optional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input name="previewRatio" placeholder="preview ratio 0~1 (optional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <textarea
              name="chapterContent"
              className="min-h-[120px] w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              placeholder="章节正文（Markdown/MDX）"
            />
            <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
              新建章节
            </button>
          </form>

          <form action={saveAdminChapterRaw} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-slate-800">
                编辑章节原文（完整 MDX + frontmatter）
              </div>
              {selectedSubject && selectedChapter ? (
                <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  {selectedSubject}/{selectedChapter}
                </span>
              ) : null}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                name="subject"
                defaultValue={selectedSubject}
                required
                placeholder="subject slug"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                name="chapter"
                defaultValue={selectedChapter}
                required
                placeholder="chapter slug"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <textarea
              name="raw"
              defaultValue={selectedRaw}
              className="min-h-[360px] w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              placeholder={"---\nsubject: thermodynamics\nsubjectTitle: \"Thermodynamics\"\nchapter: intro\nchapterTitle: \"Introduction\"\n---\n\n在这里编辑完整章节。"}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
              >
                保存章节
              </button>
            </div>
          </form>

          <form action={deleteAdminChapter} className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <input type="hidden" name="subject" value={selectedSubject} />
            <input type="hidden" name="chapter" value={selectedChapter} />
            <div className="mb-3 text-xs text-rose-700">
              删除当前章节文件：{selectedSubject && selectedChapter ? `${selectedSubject}/${selectedChapter}` : "未选择"}
            </div>
            <button
              type="submit"
              disabled={!selectedSubject || !selectedChapter}
              className="rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              删除章节
            </button>
          </form>
        </section>
      </div>

    </div>
  );
}
