import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminUser } from "@/lib/admin-access";
import { AdminContentEditor } from "@/components/AdminContentEditor";
import { contentHref, formatDate, textFor } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import { AdminRestoreButton } from "@/components/admin/AdminRestoreButton";
import { ContentHistoryPanel } from "@/components/admin/ContentHistoryPanel";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string }>;
};

export default async function AdminEditPage({ params, searchParams }: Props) {
  const locale = await getLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  try {
    const admin = await requireAdminUser();
    const [{ id }, query] = await Promise.all([params, searchParams]);
    const isNew = id === "new";
    const [modules, content] = await Promise.all([
      prisma.content.findMany({
        where: { module: { not: null }, deletedAt: null },
        select: { module: true },
        distinct: ["module"],
        orderBy: { module: "asc" },
      }),
      isNew
        ? Promise.resolve(null)
        : prisma.content.findUnique({
            where: { id },
            select: {
              id: true,
              title: true,
              slug: true,
              module: true,
              body: true,
              updatedAt: true,
              translations: true,
              isPublic: true,
              isPublished: true,
              subjectSlug: true,
              chapterSlug: true,
              order: true,
              version: true,
              deletedAt: true,
            },
          }),
    ]);
    if (!isNew && !content) notFound();
    const moduleOptions = modules
      .map((item) => item.module)
      .filter((value): value is string => Boolean(value));
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/admin" className="button-ghost mb-4 px-0 text-xs">
              ← {t("返回内容工作室", "Back to content studio")}
            </Link>
            <p className="eyebrow">{t("双语编写", "Bilingual authoring")}</p>
            <h1 className="page-heading mt-2">
              {isNew
                ? t("新建文章", "Create an article")
                : t("编辑文章", "Edit article")}
            </h1>
            <p className="muted mt-3 max-w-2xl text-sm leading-6">
              {t(
                "专注清楚的讲解。使用 Markdown 编排结构，用 LaTeX 书写公式。",
                "Make the explanation clear. Structure it with Markdown and write equations with LaTeX.",
              )}
            </p>
          </div>
          {content && (
            <div className="space-y-2 text-left sm:text-right">
              <Link
                href={contentHref(content.slug)}
                className="button-secondary"
              >
                {t("查看阅读页面", "View reading page")}{" "}
                <span aria-hidden="true">↗</span>
              </Link>
              <p className="text-xs muted">
                {t("上次更新：", "Last updated: ")}
                {formatDate(content.updatedAt, locale)}
              </p>
            </div>
          )}
        </div>
        {query?.saved === "1" && (
          <div className="notice" role="status">
            {t(
              "文章已保存。可以继续完善两种语言。",
              "Article saved. You can continue refining both languages.",
            )}
          </div>
        )}
        <div className="panel p-4 sm:p-6">
          {content?.deletedAt ? (
            <div className="space-y-4">
              <div className="notice">
                <h2 className="font-semibold">
                  {t("文章位于回收站", "This article is in the trash")}
                </h2>
                <p className="mt-2 text-sm">
                  {t(
                    "文章和两种语言都已保留。恢复后为未发布草稿，请检查后重新发布。",
                    "The article and both languages have been kept. Restore it as an unpublished draft, then review before publishing.",
                  )}
                </p>
              </div>
              <AdminRestoreButton
                id={content.id}
                version={content.version}
                title={content.title}
              />
              <ContentHistoryPanel
                contentId={content.id}
                version={content.version}
              />
            </div>
          ) : (
            <AdminContentEditor
              adminUserId={admin.id}
              key={content ? `${content.id}:${content.version}` : "new"}
              contentId={content?.id}
              initialTitle={content?.title ?? ""}
              initialSlug={content?.slug ?? ""}
              initialModule={content?.module ?? ""}
              initialBody={content?.body ?? ""}
              initialTranslations={content?.translations}
              initialIsPublic={content?.isPublic ?? true}
              initialIsPublished={content?.isPublished ?? false}
              initialSubjectSlug={content?.subjectSlug ?? ""}
              initialChapterSlug={content?.chapterSlug ?? ""}
              initialOrder={content?.order ?? 0}
              initialVersion={content?.version ?? 1}
              moduleOptions={moduleOptions}
            />
          )}
        </div>
      </div>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-8">
        <p className="eyebrow">{t("双语编写", "Bilingual authoring")}</p>
        <h1 className="page-heading">
          {t("暂时无法打开编辑器", "The editor is unavailable")}
        </h1>
        <div className="notice notice-error" role="alert">
          {t(
            "无法验证管理员权限或读取文章。请稍后重试；服务器上的内容未被修改。",
            "Administrator access or the article could not be loaded. Retry later; content on the server has not been changed.",
          )}
        </div>
        <Link href="/admin" className="button-secondary">
          {t("返回内容工作室", "Back to content studio")}
        </Link>
      </div>
    );
  }
}
