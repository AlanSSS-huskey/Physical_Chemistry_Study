import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NotesIndexPage() {
  const notes = await prisma.content.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      module: true,
      updatedAt: true
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Notes</h1>
        <p className="text-sm text-slate-600">公开可读内容。</p>
      </div>

      <div className="space-y-3">
        {notes.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            暂无文章。
          </div>
        ) : (
          notes.map((note) => (
            <Link
              key={note.id}
              href={`/notes/${note.slug}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-200 hover:bg-blue-50/40"
            >
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {note.module ?? "Notes"}
              </div>
              <div className="mt-1 text-lg font-bold text-slate-800">{note.title}</div>
              <div className="mt-1 text-xs text-slate-500">{note.updatedAt.toLocaleString()}</div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
