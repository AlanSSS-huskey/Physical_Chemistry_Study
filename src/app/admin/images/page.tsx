import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminUser } from "@/lib/admin-access";
import { AdminImageManager } from "@/components/AdminImageManager";
import { getLocale } from "@/lib/locale-server";
import { textFor } from "@/lib/i18n";

export default async function AdminImagesPage() {
  const locale = await getLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  try {
    await requireAdminUser();
    const items = await prisma.imageAsset.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        url: true,
        filename: true,
        size: true,
        createdAt: true,
      },
    });
    return (
      <div className="space-y-7">
        <div>
          <Link href="/admin" className="button-ghost mb-4 px-0 text-xs">
            ← {t("返回内容工作室", "Back to content studio")}
          </Link>
          <p className="eyebrow">{t("内容资源", "Content assets")}</p>
          <h1 className="page-heading mt-2">
            {t("图片媒体库", "Image library")}
          </h1>
          <p className="muted mt-3 max-w-2xl text-sm leading-6">
            {t(
              "保存示意图、实验图片与课程插图，随时插入你的学习笔记。",
              "Keep diagrams, experiment photos, and course illustrations ready for your study notes.",
            )}
          </p>
        </div>
        <AdminImageManager
          items={items.map((item) => ({
            ...item,
            createdAt: item.createdAt.toISOString(),
          }))}
        />
      </div>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-8">
        <p className="eyebrow">{t("内容资源", "Content assets")}</p>
        <h1 className="page-heading">
          {t("媒体库暂时不可用", "Media library unavailable")}
        </h1>
        <div className="notice notice-error" role="alert">
          {t(
            "无法验证管理员权限或读取图片数据。请稍后重试；现有图片未被删除。",
            "Administrator access or image data could not be loaded. Retry later; existing images have not been deleted.",
          )}
        </div>
        <Link href="/admin/images" className="button-secondary">
          {t("重试", "Retry")}
        </Link>
        <Link href="/admin" className="button-ghost">
          {t("返回内容工作室", "Back to content studio")}
        </Link>
      </div>
    );
  }
}
