import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { Locale } from "@/lib/i18n";

if (typeof window !== "undefined")
  throw new Error("Content service is server-only");

export type StudyContent = {
  id: string;
  slug: string;
  title: string;
  body: string;
  subjectSlug: string;
  subjectTitle: string;
  chapterSlug: string;
  order: number;
  locale: Locale;
  sourceLocale: Locale;
  translationAvailable: boolean;
  isPublic: boolean;
  isPublished: boolean;
  moduleKey: string | null;
  previewRatio: number;
  updatedAt: string | null;
  source: "database" | "file";
};

type Translation = { title: string; body: string; subjectTitle?: string };
type DatabaseContent = {
  id: string;
  slug: string;
  title: string;
  body: string;
  subjectSlug?: string | null;
  chapterSlug?: string | null;
  order?: number;
  translations?: unknown;
  module?: string | null;
  moduleRel?: { key: string } | null;
  previewRatio: number;
  isPublic: boolean;
  isPublished?: boolean;
  deletedAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

function getTranslation(value: unknown, locale: Locale): Translation | null {
  if (!value || typeof value !== "object") return null;
  const entry = (value as Record<string, unknown>)[locale];
  if (!entry || typeof entry !== "object") return null;
  const item = entry as Record<string, unknown>;
  if (
    typeof item.title !== "string" ||
    !item.title.trim() ||
    typeof item.body !== "string" ||
    !item.body.trim()
  )
    return null;
  return {
    title: item.title,
    body: item.body,
    ...(typeof item.subjectTitle === "string"
      ? { subjectTitle: item.subjectTitle }
      : {}),
  };
}

function subjectTitle(slug: string, locale: Locale): string {
  const known: Record<string, [string, string]> = {
    thermodynamics: ["热力学", "Thermodynamics"],
    kinetics: ["化学动力学", "Chemical kinetics"],
    quantum: ["量子化学", "Quantum chemistry"],
    notes: ["学习笔记", "Study notes"],
  };
  return known[slug]?.[locale === "zh" ? 0 : 1] ?? slug;
}

export function localizeDatabaseContent(
  row: DatabaseContent,
  locale: Locale,
): StudyContent {
  const legacyLocale: Locale = /\p{Script=Han}/u.test(
    `${row.title} ${row.body}`,
  )
    ? "zh"
    : "en";
  const requested = getTranslation(row.translations, locale);
  const otherLocale: Locale = locale === "zh" ? "en" : "zh";
  const fallback = getTranslation(row.translations, otherLocale);
  const selected = requested ?? fallback;
  const sourceLocale = requested
    ? locale
    : fallback
      ? otherLocale
      : legacyLocale;
  const segments = row.slug.split("/");
  const subjectSlug =
    row.subjectSlug || (segments.length > 1 ? segments[0] : "notes");
  return {
    id: row.id,
    slug: row.slug,
    title: selected?.title ?? row.title,
    body: selected?.body ?? row.body,
    subjectSlug,
    subjectTitle: selected?.subjectTitle ?? subjectTitle(subjectSlug, locale),
    chapterSlug: row.chapterSlug || segments.at(-1) || row.slug,
    order: row.order ?? 0,
    locale,
    sourceLocale,
    translationAvailable: sourceLocale === locale,
    isPublic: row.isPublic,
    isPublished: !row.deletedAt && (row.isPublished ?? true),
    moduleKey: row.moduleRel?.key ?? null,
    previewRatio: Number.isFinite(row.previewRatio)
      ? Math.min(1, Math.max(0, row.previewRatio))
      : 0.2,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    source: "database",
  };
}

/** Merge every database identity before filtering, so a private/draft row hides its sample. */
export function mergeLibrarySources(
  rows: DatabaseContent[],
  files: StudyContent[],
  locale: Locale,
): StudyContent[] {
  const items = new Map(files.map((item) => [item.slug, item]));
  for (const row of rows)
    items.set(row.slug, localizeDatabaseContent(row, locale));
  return [...items.values()]
    .filter((item) => item.isPublic && item.isPublished)
    .sort(
      (a, b) =>
        a.subjectSlug.localeCompare(b.subjectSlug) ||
        a.order - b.order ||
        a.slug.localeCompare(b.slug),
    );
}

async function loadFiles(locale: Locale): Promise<StudyContent[]> {
  const root = path.join(process.cwd(), "content");
  const paths: string[] = [];
  async function walk(directory: string) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (
        entry.isFile() &&
        entry.name.endsWith(".mdx") &&
        !entry.name.endsWith(".en.mdx")
      )
        paths.push(full);
    }
  }
  try {
    await walk(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const items: StudyContent[] = [];
  for (const file of paths) {
    const original = matter(await fs.readFile(file, "utf8"));
    const fm = original.data;
    if (
      ![fm.subject, fm.chapter, fm.chapterTitle, fm.subjectTitle].every(
        (value) => typeof value === "string" && value.trim(),
      )
    )
      continue;
    let translated: ReturnType<typeof matter> | null = null;
    try {
      translated = matter(
        await fs.readFile(file.replace(/\.mdx$/, ".en.mdx"), "utf8"),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const originalLocale: Locale = /\p{Script=Han}/u.test(
      `${fm.chapterTitle} ${original.content}`,
    )
      ? "zh"
      : "en";
    const useEnglish = locale === "en" && Boolean(translated?.content.trim());
    const selected = useEnglish && translated ? translated : original;
    const sourceLocale: Locale = useEnglish ? "en" : originalLocale;
    const slug = `${fm.subject}/${fm.chapter}`;
    const rawRatio =
      typeof fm.previewRatio === "number" && Number.isFinite(fm.previewRatio)
        ? fm.previewRatio
        : 0.2;
    items.push({
      id: `file:${slug}`,
      slug,
      title:
        typeof selected.data.chapterTitle === "string"
          ? selected.data.chapterTitle
          : fm.chapterTitle,
      body: selected.content,
      subjectSlug: fm.subject,
      subjectTitle:
        typeof selected.data.subjectTitle === "string"
          ? selected.data.subjectTitle
          : subjectTitle(fm.subject, locale),
      chapterSlug: fm.chapter,
      order:
        typeof fm.order === "number" && Number.isFinite(fm.order)
          ? fm.order
          : 0,
      locale,
      sourceLocale,
      translationAvailable: sourceLocale === locale,
      isPublic: fm.isPublic !== false,
      isPublished: fm.isPublished !== false,
      moduleKey:
        typeof fm.moduleKey === "string" && fm.moduleKey.trim()
          ? fm.moduleKey
          : null,
      previewRatio: Math.min(1, Math.max(0, rawRatio)),
      updatedAt: null,
      source: "file",
    });
  }
  return items;
}

/** Bundled identities must retain their database override when unpublished. */
export async function isBundledContent(slug: string): Promise<boolean> {
  if (
    slug.length > 240 ||
    !/^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/.test(slug)
  )
    return false;
  return (await loadFiles("zh")).some((item) => item.slug === slug);
}

export async function loadLibrary(
  locale: Locale,
): Promise<{ items: StudyContent[]; databaseAvailable: boolean }> {
  const files = await loadFiles(locale);
  if (
    process.env.CHEMISTRY_CONTENT_MODE === "bundled" ||
    !process.env.DATABASE_URL?.trim()
  )
    return {
      items: mergeLibrarySources([], files, locale),
      databaseAvailable: false,
    };
  try {
    const { prisma } = await import("@/lib/db");
    const rows = await prisma.content.findMany({
      include: { moduleRel: { select: { key: true } } },
    });
    return {
      items: mergeLibrarySources(rows, files, locale),
      databaseAvailable: true,
    };
  } catch {
    // A configured database is authoritative: a failed read must not reveal a
    // bundled identity that the unavailable database may have made private.
    return { items: [], databaseAvailable: false };
  }
}

/** Raw server-side content: callers must resolve access before rendering or serializing the body. */
export async function loadContent(
  slug: string,
  locale: Locale,
): Promise<{ content: StudyContent | null; databaseAvailable: boolean }> {
  if (
    slug.length > 240 ||
    !/^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/.test(slug)
  )
    return { content: null, databaseAvailable: false };
  let databaseAvailable = false;
  if (
    process.env.CHEMISTRY_CONTENT_MODE !== "bundled" &&
    process.env.DATABASE_URL?.trim()
  ) {
    try {
      const { prisma } = await import("@/lib/db");
      const row = await prisma.content.findUnique({
        where: { slug },
        include: { moduleRel: { select: { key: true } } },
      });
      databaseAvailable = true;
      if (row)
        return {
          content: row.deletedAt ? null : localizeDatabaseContent(row, locale),
          databaseAvailable,
        };
    } catch {
      return { content: null, databaseAvailable: false };
    }
  }
  const files = await loadFiles(locale);
  return {
    content: files.find((item) => item.slug === slug) ?? null,
    databaseAvailable,
  };
}
