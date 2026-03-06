import Link from "next/link";
import { getNavigationTree } from "@/lib/content";

export async function Sidebar() {
  const tree = await getNavigationTree();

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-black uppercase tracking-wider text-slate-400">
        Subject Index
      </div>
      <div className="space-y-6">
        {tree.subjects.map((s) => (
          <div key={s.slug} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-slate-800">{s.title}</div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                {s.chapters.length}
              </span>
            </div>
            <ul className="space-y-1">
              {s.chapters.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/learn/${s.slug}/${c.slug}`}
                    className="block rounded-lg border border-transparent px-3 py-2 text-sm text-slate-600 hover:border-blue-100 hover:bg-blue-50 hover:text-blue-800"
                  >
                    {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
