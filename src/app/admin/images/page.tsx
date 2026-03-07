import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminUser } from "@/lib/admin-access";
import { AdminImageManager } from "@/components/AdminImageManager";

export default async function AdminImagesPage() {
  await requireAdminUser();

  const items = await prisma.imageAsset.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      url: true,
      filename: true,
      size: true,
      createdAt: true
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Admin Images</h1>
          <p className="text-sm text-slate-600">查看和管理已上传图片资源。</p>
        </div>
        <Link
          href="/admin"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          返回 Admin
        </Link>
      </div>

      <AdminImageManager
        items={items.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString()
        }))}
      />
    </div>
  );
}
