import Link from "next/link";
import { getSessionState } from "@/lib/auth";
import { getLocale } from "@/lib/locale-server";
import { contentHref, formatDate, textFor } from "@/lib/i18n";
import { loadLibrary, loadContent } from "@/lib/content-service";
import type { StudyContent } from "@/lib/content-service";
import { resolveContentAccess } from "@/lib/content-access";
import { loadUserProgress } from "@/lib/progress";

export default async function AccountPage() {
  const [locale, session] = await Promise.all([getLocale(), getSessionState()]);
  const title = textFor(locale, "我的学习", "My learning");
  const heading = (
    <div className="space-y-3">
      <p className="eyebrow">{textFor(locale, "学习记录", "YOUR PROGRESS")}</p>
      <h1 className="page-heading">{title}</h1>
      <p className="muted">
        {textFor(
          locale,
          "中英文版本共享学习进度，切换语言后仍可从上次的位置继续。",
          "Your Chinese and English progress stays together, so you can switch languages and keep going.",
        )}
      </p>
    </div>
  );

  if (session.status !== "authenticated") {
    const message =
      session.status === "unconfigured"
        ? textFor(
            locale,
            "登录服务尚未配置。配置完成后，你可以使用 Google 登录并保存学习进度。",
            "Sign-in has not been configured yet. Once setup is complete, you can sign in with Google and save your progress.",
          )
        : session.status === "unavailable"
          ? textFor(
              locale,
              "账户服务暂时不可用，无法读取你的学习记录。请稍后重试。",
              "Your account is temporarily unavailable. Please try again shortly to load your learning record.",
            )
          : textFor(
              locale,
              "登录后可查看已完成章节，并继续上次的学习。",
              "Sign in to see completed chapters and continue your learning.",
            );
    return (
      <div className="mx-auto max-w-4xl space-y-8">
        {heading}
        <div className="panel space-y-5 p-6">
          <p
            className={
              session.status === "unavailable"
                ? "notice notice-error"
                : "notice"
            }
            role="status"
          >
            {message}
          </p>
          <div className="flex flex-wrap gap-3">
            {session.status === "anonymous" && (
              <Link className="button" href="/login?callbackUrl=%2Faccount">
                {textFor(locale, "使用 Google 登录", "Sign in with Google")}
              </Link>
            )}
            {session.status === "unavailable" && (
              <Link className="button-secondary" href="/account">
                {textFor(locale, "重新加载", "Try again")}
              </Link>
            )}
            <Link className="button-ghost" href="/learn">
              {textFor(locale, "浏览学习内容 →", "Browse the library →")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const user = session.user;
  const [library, progress] = await Promise.all([
    loadLibrary(locale),
    loadUserProgress(user.id),
  ]);
  if (!progress.available)
    return (
      <div className="mx-auto max-w-4xl space-y-8">
        {heading}
        <div className="notice notice-error space-y-4" role="status">
          <p>
            {textFor(
              locale,
              "你的学习记录暂时无法读取，已有进度不会被重置。请稍后重试。",
              "Your learning record could not be loaded. Your saved progress has not been reset. Please try again shortly.",
            )}
          </p>
          <Link className="button-secondary" href="/account">
            {textFor(locale, "重新加载", "Try again")}
          </Link>
        </div>
      </div>
    );

  const candidates = new Map<string, StudyContent>(
    library.items.map((item) => [item.slug, item]),
  );
  // Saved private chapters may not appear in the public library. Resolve each
  // recent identity again before showing its title or a link to its content.
  const savedExtra = await Promise.all(
    progress.items
      .slice(0, 50)
      .filter((item) => !candidates.has(item.contentSlug))
      .map(
        async (item) => (await loadContent(item.contentSlug, locale)).content,
      ),
  );
  for (const content of savedExtra)
    if (content) candidates.set(content.slug, content);
  const access = await Promise.allSettled(
    [...candidates.values()].map(async (content) =>
      (await resolveContentAccess(content, user.id)) === "full" &&
      content.isPublished
        ? content
        : null,
    ),
  );
  const readable = access.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : [],
  );
  const readableBySlug = new Map(readable.map((item) => [item.slug, item]));
  const progressBySlug = new Map(
    progress.items.map((item) => [item.contentSlug, item]),
  );
  const recent = progress.items
    .filter((item) => readableBySlug.has(item.contentSlug))
    .slice(0, 12);
  const inProgress = recent.find((item) => item.status === "IN_PROGRESS");
  const next =
    (inProgress && readableBySlug.get(inProgress.contentSlug)) ||
    readable.find(
      (item) => progressBySlug.get(item.slug)?.status !== "COMPLETED",
    ) ||
    (recent[0] && readableBySlug.get(recent[0].contentSlug));
  const completedCount = progress.items.filter(
    (item) => item.status === "COMPLETED",
  ).length;
  const inProgressCount = progress.items.filter(
    (item) => item.status === "IN_PROGRESS",
  ).length;
  const permissionUnavailable = access.some(
    (result) => result.status === "rejected",
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {heading}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
        <p className="font-medium">
          {user.name || user.email || textFor(locale, "我的账户", "My account")}
        </p>
        {user.name && user.email && (
          <span className="muted text-sm">{user.email}</span>
        )}
        <Link className="button-secondary" href="/account/settings">
          {textFor(locale, "账户设置", "Account settings")}
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          [textFor(locale, "已完成章节", "Chapters completed"), completedCount],
          [textFor(locale, "学习中", "In progress"), inProgressCount],
          [
            textFor(locale, "已保存章节", "Saved chapters"),
            progress.items.length,
          ],
        ].map(([label, value]) => (
          <div className="panel p-5" key={label}>
            <p className="muted text-sm">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      {(!library.databaseAvailable || permissionUnavailable) && (
        <div className="notice text-sm" role="status">
          {textFor(
            locale,
            "部分章节暂时无法加载。你已保存的学习记录仍然保留，请稍后刷新重试。",
            "Some chapters could not be loaded. Your saved learning record is still retained. Please refresh shortly to try again.",
          )}
        </div>
      )}
      {next && (
        <section className="panel flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="eyebrow">{textFor(locale, "下一步", "KEEP GOING")}</p>
            <h2 className="section-heading">{next.title}</h2>
            <p className="muted text-sm">{next.subjectTitle}</p>
          </div>
          <Link className="button shrink-0" href={contentHref(next.slug)}>
            {textFor(locale, "继续学习 →", "Continue learning →")}
          </Link>
        </section>
      )}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="section-heading">
            {textFor(locale, "最近的学习记录", "Recent learning")}
          </h2>
          <Link className="button-ghost text-sm" href="/learn">
            {textFor(locale, "全部章节 →", "All chapters →")}
          </Link>
        </div>
        {recent.length ? (
          <div className="panel divide-y">
            {recent.map((record) => {
              const content = readableBySlug.get(record.contentSlug)!;
              return (
                <div
                  className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                  key={record.contentSlug}
                >
                  <div className="space-y-1">
                    <Link
                      className="font-medium hover:underline"
                      href={contentHref(content.slug)}
                    >
                      {content.title}
                    </Link>
                    <p className="muted text-sm">
                      {content.subjectTitle} ·{" "}
                      {formatDate(record.updatedAt, locale)}
                    </p>
                  </div>
                  <span className="badge self-start">
                    {record.status === "COMPLETED"
                      ? textFor(locale, "已完成", "Completed")
                      : record.status === "IN_PROGRESS"
                        ? textFor(locale, "学习中", "In progress")
                        : textFor(locale, "尚未开始", "Not started")}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="panel space-y-3 p-6">
            <p className="font-medium">
              {progress.items.length
                ? textFor(
                    locale,
                    "已保存记录的章节暂时无法打开",
                    "Your saved chapters are currently unavailable",
                  )
                : textFor(
                    locale,
                    "从第一个章节开始",
                    "Start with your first chapter",
                  )}
            </p>
            <p className="muted text-sm">
              {progress.items.length
                ? textFor(
                    locale,
                    "你的记录仍然保留。请稍后重试，或浏览当前可用的章节。",
                    "Your learning record is retained. Try again shortly, or browse the chapters currently available.",
                  )
                : textFor(
                    locale,
                    "阅读后点击“标记为已完成”，这里就会显示你的学习记录。",
                    "After reading, select “Mark as complete” and your learning record will appear here.",
                  )}
            </p>
            <Link className="button-secondary" href="/learn">
              {textFor(locale, "浏览学习内容", "Browse the library")}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
