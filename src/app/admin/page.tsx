import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminUser } from "@/lib/admin-access";
import { deleteContentById } from "@/app/admin/content-actions";

type Props = {
  searchParams?: Promise<{ deleted?: string; error?: string }>;
};

export default async function AdminPage({ searchParams }: Props) {
  await requireAdminUser();

  const [items, params] = await Promise.all([
    prisma.content.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        module: true,
        updatedAt: true
      }
    }),
    searchParams
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Admin Panel</h1>
          <p className="text-sm text-slate-600">管理文章内容、编辑和删除。</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/images"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            图片管理
          </Link>
          <Link
            href="/admin/edit/new"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            新建文章
          </Link>
        </div>
      </div>

      {params?.deleted === "1" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          文章已删除。
        </div>
      )}
      {params?.error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          操作失败：{params.error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Module/Subject</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                  还没有文章，点击右上角「新建文章」开始。
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold text-slate-800">{item.title}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.slug}</td>
                  <td className="px-4 py-3 text-slate-600">{item.module ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {item.updatedAt.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/edit/${item.id}`}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/notes/${item.slug}`}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        View
                      </Link>
                      <form action={deleteContentById}>
                        <input type="hidden" name="id" value={item.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
