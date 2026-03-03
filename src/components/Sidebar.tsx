import Link from "next/link";
import { getNavigationTree } from "@/lib/content";

export async function Sidebar() {
  const tree = await getNavigationTree();

  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Subjects
      </div>
      <div className="space-y-6">
        {tree.subjects.map((s) => (
          <div key={s.slug} className="space-y-2">
            <div className="text-sm font-semibold text-zinc-900">{s.title}</div>
            <ul className="space-y-1">
              {s.chapters.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/learn/${s.slug}/${c.slug}`}
                    className="block rounded px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
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

