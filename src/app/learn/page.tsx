import Link from "next/link";
import { getNavigationTree } from "@/lib/content";

export default async function LearnIndexPage() {
  const tree = await getNavigationTree();
  const totalChapters = tree.subjects.reduce((acc, subject) => acc + subject.chapters.length, 0);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Study Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">公开浏览可用，后续通过 entitlement 控制完整内容权限。</p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-sm">
          <div className="rounded-xl bg-slate-50 p-4 text-center">
            <div className="text-2xl font-black text-slate-900">{tree.subjects.length}</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Subjects</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 text-center">
            <div className="text-2xl font-black text-blue-700">{totalChapters}</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Chapters</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {tree.subjects.map((s) => (
          <div key={s.slug} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Subject</div>
                <div className="text-lg font-bold text-slate-800">{s.title}</div>
                <div className="text-sm text-slate-500">{s.chapters.length} 章</div>
              </div>
              {s.chapters[0] ? (
                <Link
                  href={`/learn/${s.slug}/${s.chapters[0].slug}`}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                >
                  进入第一章
                </Link>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
