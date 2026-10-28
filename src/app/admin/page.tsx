import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminUser } from "@/lib/admin-access";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { contentHref, formatDate, textFor } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import { adminErrorMessage, readTranslationDrafts } from "@/lib/editor";

type Props = {
  searchParams?: Promise<{
    deleted?: string;
    error?: string;
    q?: string;
    state?: string;
  }>;
};

export default async function AdminPage({ searchParams }: Props) {
  const locale = await getLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  try {
    await requireAdminUser();
    const [items, query] = await Promise.all([
      prisma.content.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          module: true,
          updatedAt: true,
          translations: true,
          isPublished: true,
          isPublic: true,
          subjectSlug: true,
          chapterSlug: true,
        },
      }),
      searchParams,
    ]);
    const rawSearch = typeof query?.q === "string" ? query.q : "";
    const search = rawSearch.trim().toLocaleLowerCase();
    const state =
      query?.state === "published" || query?.state === "draft"
        ? query.state
        : "all";
    const visible = items
      .map((item) => {
        const translations = readTranslationDrafts(
          item.title,
          "",
          item.translations,
        );
        const title =
          translations[locale].title ||
          translations[locale === "zh" ? "en" : "zh"].title ||
          item.title;
        return { ...item, title, translations };
      })
      .filter(
        (item) =>
          (!search ||
            [
              item.title,
              item.slug,
              item.module,
              item.translations.zh.title,
              item.translations.en.title,
            ]
              .filter(Boolean)
              .join(" ")
              .toLocaleLowerCase()
              .includes(search)) &&
          (state === "all" || item.isPublished === (state === "published")),
      );

    return (
      <div className="space-y-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{t("内容工作室", "Content studio")}</p>
            <h1 className="page-heading mt-2">
              {t("管理学习内容", "Manage your library")}
            </h1>
            <p className="muted mt-3 max-w-2xl text-sm leading-6">
              {t(
                "在同一处编写双语笔记、安排阅读顺序，并管理发布状态。",
                "Write bilingual notes, organize the reading sequence, and manage publishing in one place.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/images" className="button-secondary">
              {t("媒体库", "Media library")}
            </Link>
            <Link href="/admin/edit/new" className="button">
              {t("新建文章", "New article")} <span aria-hidden="true">+</span>
            </Link>
          </div>
        </div>
        {query?.deleted === "1" && (
          <p className="notice" role="status">
            {t(
              "文章及其翻译已删除。",
              "The article and its translations have been deleted.",
            )}
          </p>
        )}
        {query?.error && (
          <p className="notice notice-error" role="alert">
            {query.error === "bundled"
              ? adminErrorMessage("BUNDLED_CONTENT", 409, locale)
              : t(
                  "无法完成此操作。内容服务可能暂时不可用，请重试。",
                  "The action could not be completed. The content service may be unavailable; please retry.",
                )}
          </p>
        )}
        <div className="panel overflow-hidden">
          <form
            method="get"
            action="/admin"
            className="flex flex-col gap-4 border-b border-[var(--border)] p-5 sm:flex-row sm:items-end"
          >
            <div className="min-w-0 flex-1">
              <label
                htmlFor="content-search"
                className="mb-2 block text-xs font-semibold"
              >
                {t("查找文章", "Find an article")}
              </label>
              <input
                id="content-search"
                name="q"
                type="search"
                defaultValue={rawSearch}
                placeholder={t(
                  "搜索标题、链接或学科分类…",
                  "Search title, URL, or category…",
                )}
                className="input w-full"
              />
            </div>
            <div className="sm:w-40">
              <label
                htmlFor="content-state"
                className="mb-2 block text-xs font-semibold"
              >
                {t("发布状态", "Status")}
              </label>
              <select
                id="content-state"
                name="state"
                defaultValue={state}
                className="input w-full"
              >
                <option value="all">{t("全部文章", "All articles")}</option>
                <option value="published">{t("已发布", "Published")}</option>
                <option value="draft">{t("草稿", "Drafts")}</option>
              </select>
            </div>
            <button type="submit" className="button-secondary">
              {t("筛选", "Filter")}
            </button>
            {(search || state !== "all") && (
              <Link href="/admin" className="button-ghost">
                {t("清除", "Clear")}
              </Link>
            )}
          </form>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-3 text-xs muted">
            <span>
              {t(
                `显示 ${visible.length} / ${items.length} 篇文章`,
                `Showing ${visible.length} of ${items.length} ${items.length === 1 ? "article" : "articles"}`,
              )}
            </span>
            <span>{t("按最近更新排序", "Most recently updated first")}</span>
          </div>
          {visible.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <h2 className="section-heading">
                {items.length === 0
                  ? t("从第一篇笔记开始", "Start with your first note")
                  : t("没有找到匹配的文章", "No matching articles")}
              </h2>
              <p className="muted mx-auto mt-2 max-w-md text-sm leading-6">
                {items.length === 0
                  ? t(
                      "建立一份清晰的双语学习资料。先保存为草稿，准备好后再发布。",
                      "Create a clear bilingual study resource. Save a draft first, then publish when it is ready.",
                    )
                  : t(
                      "尝试其他关键词，或清除筛选查看全部内容。",
                      "Try another search, or clear the filters to see everything.",
                    )}
              </p>
              <Link
                className="button-secondary mt-5"
                href={items.length === 0 ? "/admin/edit/new" : "/admin"}
              >
                {items.length === 0
                  ? t("新建文章", "Create article")
                  : t("查看全部文章", "Show all articles")}
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]" role="list">
              {visible.map((item) => (
                <li
                  key={item.id}
                  className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_9rem_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="min-w-0 break-words text-base font-semibold">
                        <Link
                          href={`/admin/edit/${encodeURIComponent(item.id)}`}
                          className="hover:text-[var(--accent)]"
                        >
                          {item.title}
                        </Link>
                      </h2>
                      <span className="badge">
                        {item.isPublished
                          ? t("已发布", "Published")
                          : t("草稿", "Draft")}
                      </span>
                      <span className="text-xs muted">
                        {item.isPublic
                          ? t("公开", "Public")
                          : t("需访问权限", "Restricted")}
                      </span>
                    </div>
                    <p className="mt-1.5 break-all font-mono text-xs muted">
                      /{item.slug}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs muted">
                      {item.module && <span>{item.module}</span>}
                      {item.translations.zh.title && (
                        <span>{t("中文已填写", "Chinese available")}</span>
                      )}
                      {item.translations.en.title && (
                        <span>{t("英文已填写", "English available")}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs muted">
                    <span className="lg:block">{t("更新于", "Updated")}</span>
                    <time
                      dateTime={item.updatedAt.toISOString()}
                      className="ml-2 lg:ml-0 lg:mt-1 lg:block"
                    >
                      {formatDate(item.updatedAt, locale)}
                    </time>
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    <Link
                      href={`/admin/edit/${encodeURIComponent(item.id)}`}
                      className="button-secondary px-3 py-1.5 text-xs"
                      aria-label={t(`编辑 ${item.title}`, `Edit ${item.title}`)}
                    >
                      {t("编辑", "Edit")}
                    </Link>
                    <Link
                      href={contentHref(item.slug)}
                      className="button-ghost px-2 py-1.5 text-xs"
                      aria-label={t(`查看 ${item.title}`, `View ${item.title}`)}
                    >
                      {t("查看", "View")}
                    </Link>
                    <AdminDeleteButton
                      endpoint={`/api/admin/content/${encodeURIComponent(item.id)}`}
                      title={item.title}
                      kind="content"
                    />
                  </div>
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
      <div className="mx-auto max-w-2xl space-y-4 py-8">
        <p className="eyebrow">{t("内容工作室", "Content studio")}</p>
        <h1 className="page-heading">
          {t("内容服务暂时不可用", "Content service unavailable")}
        </h1>
        <div className="notice notice-error" role="alert">
          {t(
            "目前无法验证管理员权限或读取内容数据库。请稍后重试；现有内容未被修改。",
            "Administrator access or the content database cannot be checked right now. Please retry later; existing content has not been changed.",
          )}
        </div>
        <Link href="/admin" className="button-secondary">
          {t("重试", "Retry")}
        </Link>
      </div>
    );
  }
}
