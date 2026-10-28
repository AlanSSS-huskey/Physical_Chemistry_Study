"use client";

import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";
import { noteHref } from "@/lib/editor";

export type ArticleMetadataValues = {
  slug: string;
  module: string;
  subjectSlug: string;
  chapterSlug: string;
  order: string;
  isPublic: boolean;
  isPublished: boolean;
};

type Props = {
  fields: ArticleMetadataValues;
  moduleOptions: string[];
  canRegenerateSlug: boolean;
  onSlugChange: (value: string) => void;
  onRegenerateSlug: () => void;
  onFieldChange: <K extends keyof ArticleMetadataValues>(
    key: K,
    value: ArticleMetadataValues[K],
  ) => void;
};

export function ArticleMetadataFields({
  fields,
  moduleOptions,
  canRegenerateSlug,
  onSlugChange,
  onRegenerateSlug,
  onFieldChange,
}: Props) {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);

  return (
    <section
      className="grid gap-6 border-t border-[var(--border)] pt-6 lg:grid-cols-[1.4fr_1fr]"
      aria-labelledby="settings-heading"
    >
      <div className="space-y-4">
        <div>
          <h2 id="settings-heading" className="section-heading">
            {t("链接与目录", "URL & organization")}
          </h2>
          <p className="muted mt-1 text-sm">
            {t(
              "链接使用共同的英文标识，切换语言不会改变地址。",
              "A shared slug keeps the URL consistent across languages.",
            )}
          </p>
        </div>
        <div>
          <label
            htmlFor="article-slug"
            className="mb-2 block text-sm font-semibold"
          >
            {t("文章链接标识", "Article slug")}
          </label>
          <input
            id="article-slug"
            maxLength={240}
            className="input w-full font-mono text-sm"
            value={fields.slug}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            aria-describedby="slug-help"
            onChange={(event) => onSlugChange(event.target.value)}
            placeholder="thermodynamics/first-law"
          />
          <p id="slug-help" className="mt-1 break-all text-xs muted">
            {fields.slug
              ? noteHref(fields.slug)
              : t(
                  "填写英文标题可自动生成，也可以手动输入。",
                  "Add an English title to generate a slug, or enter one manually.",
                )}
          </p>
          {canRegenerateSlug && (
            <button
              type="button"
              className="button-ghost mt-1 px-0 text-xs"
              onClick={onRegenerateSlug}
            >
              {t("从标题重新生成", "Generate from title")}
            </button>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="article-subject"
              className="mb-2 block text-sm font-semibold"
            >
              {t("学科标识", "Subject slug")}
            </label>
            <input
              id="article-subject"
              maxLength={80}
              className="input w-full"
              value={fields.subjectSlug}
              onChange={(event) =>
                onFieldChange("subjectSlug", event.target.value)
              }
              placeholder="physical-chemistry"
            />
          </div>
          <div>
            <label
              htmlFor="article-chapter"
              className="mb-2 block text-sm font-semibold"
            >
              {t("章节标识", "Chapter slug")}
            </label>
            <input
              id="article-chapter"
              maxLength={80}
              className="input w-full"
              value={fields.chapterSlug}
              onChange={(event) =>
                onFieldChange("chapterSlug", event.target.value)
              }
              placeholder="thermodynamics"
            />
          </div>
          <div>
            <label
              htmlFor="article-module"
              className="mb-2 block text-sm font-semibold"
            >
              {t("学科分类", "Category")}
            </label>
            <input
              id="article-module"
              maxLength={120}
              className="input w-full"
              list="module-options"
              value={fields.module}
              onChange={(event) => onFieldChange("module", event.target.value)}
              placeholder={t("可选", "Optional")}
            />
            <datalist id="module-options">
              {moduleOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
          <div>
            <label
              htmlFor="article-order"
              className="mb-2 block text-sm font-semibold"
            >
              {t("目录排序", "Reading order")}
            </label>
            <input
              id="article-order"
              className="input w-full"
              inputMode="numeric"
              type="number"
              min="0"
              max="100000"
              step="1"
              value={fields.order}
              onChange={(event) => onFieldChange("order", event.target.value)}
            />
            <p className="mt-1 text-xs muted">
              {t("数字越小，排序越靠前。", "Lower numbers appear first.")}
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-4 rounded-md border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="section-heading">{t("发布设置", "Publishing")}</h2>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            className="mt-1 h-4 w-4 accent-[var(--accent)]"
            type="checkbox"
            checked={fields.isPublished}
            onChange={(event) =>
              onFieldChange("isPublished", event.target.checked)
            }
          />
          <span>
            <span className="block text-sm font-semibold">
              {t("发布文章", "Publish article")}
            </span>
            <span className="mt-1 block text-xs leading-5 muted">
              {t(
                "开启后出现在阅读目录；关闭则仅管理员可见。",
                "Show in the reading library. When off, only administrators can access the draft.",
              )}
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            className="mt-1 h-4 w-4 accent-[var(--accent)]"
            type="checkbox"
            checked={fields.isPublic}
            onChange={(event) =>
              onFieldChange("isPublic", event.target.checked)
            }
          />
          <span>
            <span className="block text-sm font-semibold">
              {t("公开展示与预览", "Public listing & preview")}
            </span>
            <span className="mt-1 block text-xs leading-5 muted">
              {t(
                "控制公开展示与预览。文章仍遵循已有的课程访问权限规则。",
                "Controls public listing and preview. Existing course access rules still apply.",
              )}
            </span>
          </span>
        </label>
        <p className="border-t border-[var(--border)] pt-4 text-xs leading-5 muted">
          {t(
            "保存会同时更新两种语言及发布设置。",
            "Saving updates both languages and publishing settings together.",
          )}
        </p>
      </div>
    </section>
  );
}
