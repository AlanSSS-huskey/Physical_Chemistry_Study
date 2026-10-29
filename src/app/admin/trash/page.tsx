import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminUser } from "@/lib/admin-access";
import { getLocale } from "@/lib/locale-server";
import { formatDate, textFor } from "@/lib/i18n";
import { AdminRestoreButton } from "@/components/admin/AdminRestoreButton";

export default async function AdminTrashPage() {
  const locale = await getLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  try {
    await requireAdminUser();
    const items = await prisma.content.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        version: true,
        deletedAt: true,
      },
    });
    return (
      <div className="space-y-6">
        <div>
          <Link href="/admin" className="button-ghost mb-4 px-0 text-xs">
            ← {t("返回内容工作室", "Back to content studio")}
          </Link>
          <p className="eyebrow">{t("内容恢复", "Content recovery")}</p>
          <h1 className="page-heading mt-2">{t("回收站", "Trash")}</h1>
          <p className="muted mt-3 max-w-2xl text-sm leading-6">
            {t(
              "这里的文章不会出现在学习目录和搜索结果中。文章、翻译和历史记录仍保留；恢复后需要检查并重新发布。",
              "These articles are hidden from the learning library and search. Their translations and version history are kept. Review and republish after restoring.",
            )}
          </p>
        </div>
        <div className="panel overflow-hidden">
          {items.length === 0 ? (
            <p className="p-8 text-sm muted" role="status">
              {t("回收站为空。", "The trash is empty.")}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-5"
                >
                  <div className="min-w-0">
                    <Link
                      className="font-semibold break-words hover:text-[var(--accent)]"
                      href={`/admin/edit/${encodeURIComponent(item.id)}`}
                    >
                      {item.title}
                    </Link>
                    <p className="mt-1 break-all font-mono text-xs muted">
                      /{item.slug}
                    </p>
                    {item.deletedAt && (
                      <p className="mt-2 text-xs muted">
                        {t("移入时间：", "Moved to trash: ")}
                        <time dateTime={item.deletedAt.toISOString()}>
                          {formatDate(item.deletedAt, locale)}
                        </time>
                      </p>
                    )}
                  </div>
                  <AdminRestoreButton
                    id={item.id}
                    version={item.version}
                    title={item.title}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <div className="space-y-4 py-8">
        <h1 className="page-heading">
          {t("暂时无法读取回收站", "Trash is unavailable")}
        </h1>
        <p className="notice notice-error" role="alert">
          {t(
            "无法验证管理员权限或读取文章，请稍后重试。",
            "Administrator access or articles could not be loaded. Please retry shortly.",
          )}
        </p>
        <Link className="button-secondary" href="/admin/trash">
          {t("重试", "Retry")}
        </Link>
      </div>
    );
  }
}
