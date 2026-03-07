import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminUser } from "@/lib/admin-access";
import { AdminContentEditor } from "@/components/AdminContentEditor";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string }>;
};

export default async function AdminEditPage({ params, searchParams }: Props) {
  await requireAdminUser();

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const isNew = id === "new";

  const moduleOptionsPromise = prisma.content.findMany({
    where: { module: { not: null } },
    select: { module: true },
    distinct: ["module"],
    orderBy: { module: "asc" }
  });

  const content = isNew
    ? null
    : await prisma.content.findUnique({
        where: { id },
        select: { id: true, title: true, slug: true, module: true, body: true, updatedAt: true }
      });

  const moduleOptions = (await moduleOptionsPromise)
    .map((item) => item.module)
    .filter((value): value is string => Boolean(value));

  if (!isNew && !content) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            {isNew ? "Create Article" : "Edit Article"}
          </h1>
          <p className="text-sm text-slate-600">
            支持 Markdown/MDX、LaTeX、图片上传、拖拽和粘贴截图。
          </p>
        </div>
        <Link
          href="/admin"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          返回 Admin
        </Link>
      </div>

      {query?.saved === "1" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          保存成功。
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <AdminContentEditor
          contentId={content?.id}
          initialTitle={content?.title ?? ""}
          initialSlug={content?.slug ?? ""}
          initialModule={content?.module ?? ""}
          initialBody={content?.body ?? ""}
          moduleOptions={moduleOptions}
        />
      </div>
    </div>
  );
}
