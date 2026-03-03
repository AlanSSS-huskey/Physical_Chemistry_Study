import Link from "next/link";
import { getNavigationTree } from "@/lib/content";

export default async function LearnIndexPage() {
  const tree = await getNavigationTree();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Learn</h1>
        <p className="text-sm text-zinc-700">
          公开浏览（无需登录）。后续会通过 entitlement 控制可见范围。
        </p>
      </div>

      <div className="grid gap-4">
        {tree.subjects.map((s) => (
          <div key={s.slug} className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">{s.title}</div>
                <div className="text-sm text-zinc-700">{s.chapters.length} 章</div>
              </div>
              {s.chapters[0] ? (
                <Link
                  href={`/learn/${s.slug}/${s.chapters[0].slug}`}
                  className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
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

