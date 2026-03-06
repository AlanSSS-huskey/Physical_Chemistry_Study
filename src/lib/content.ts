import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const CONTENT_ROOT = path.join(process.cwd(), "content");

export type ContentFrontmatter = {
  subject: string;
  subjectTitle: string;
  chapter: string;
  chapterTitle: string;
  order?: number;
  moduleKey?: string;
  previewRatio?: number;
};

export type ChapterNavItem = {
  slug: string;
  title: string;
  order: number;
};

export type SubjectNavItem = {
  slug: string;
  title: string;
  chapters: ChapterNavItem[];
};

export class ContentNotFoundError extends Error {
  constructor(public readonly subject: string, public readonly chapter: string) {
    super(`Content not found for ${subject}/${chapter}`);
    this.name = "ContentNotFoundError";
  }
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseFrontmatter(
  data: unknown
): ContentFrontmatter | null {
  if (!data || typeof data !== "object") return null;

  const record = data as Record<string, unknown>;
  const subject = asNonEmptyString(record.subject);
  const subjectTitle = asNonEmptyString(record.subjectTitle);
  const chapter = asNonEmptyString(record.chapter);
  const chapterTitle = asNonEmptyString(record.chapterTitle);

  if (!subject || !subjectTitle || !chapter || !chapterTitle) {
    return null;
  }

  const previewRatioRaw = asNumber(record.previewRatio);
  const previewRatio =
    previewRatioRaw === undefined
      ? undefined
      : Math.min(1, Math.max(0, previewRatioRaw));

  return {
    subject,
    subjectTitle,
    chapter,
    chapterTitle,
    order: asNumber(record.order),
    moduleKey: asNonEmptyString(record.moduleKey) ?? undefined,
    previewRatio
  };
}

export async function listMdxFiles(): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) await walk(full);
      else if (ent.isFile() && full.endsWith(".mdx")) out.push(full);
    }
  }

  try {
    await walk(CONTENT_ROOT);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }
    throw error;
  }
  return out;
}

export async function getNavigationTree(): Promise<{ subjects: SubjectNavItem[] }> {
  const files = await listMdxFiles();
  const bySubject = new Map<string, SubjectNavItem>();

  for (const file of files) {
    const raw = await fs.readFile(file, "utf8");
    const { data } = matter(raw);
    const fm = parseFrontmatter(data);
    if (!fm) continue;

    const subjectSlug = fm.subject;
    const chapterSlug = fm.chapter;
    const subjectTitle = fm.subjectTitle;
    const chapterTitle = fm.chapterTitle;
    const order = typeof fm.order === "number" ? fm.order : 999;

    const subj =
      bySubject.get(subjectSlug) ??
      ({
        slug: subjectSlug,
        title: subjectTitle,
        chapters: []
      } satisfies SubjectNavItem);

    if (!bySubject.has(subjectSlug)) bySubject.set(subjectSlug, subj);

    if (!subj.chapters.some((c) => c.slug === chapterSlug)) {
      subj.chapters.push({ slug: chapterSlug, title: chapterTitle, order });
    }
  }

  const subjects = [...bySubject.values()].map((s) => ({
    ...s,
    chapters: [...s.chapters].sort(
      (a, b) => a.order - b.order || a.title.localeCompare(b.title)
    )
  }));

  subjects.sort((a, b) => a.title.localeCompare(b.title) || a.slug.localeCompare(b.slug));

  return { subjects };
}

export async function getMdxBySlug(params: {
  subject: string;
  chapter: string;
}): Promise<{ frontmatter: ContentFrontmatter; content: string }> {
  const file = path.join(CONTENT_ROOT, params.subject, `${params.chapter}.mdx`);
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      throw new ContentNotFoundError(params.subject, params.chapter);
    }
    throw error;
  }
  const { data, content } = matter(raw);
  const fm = parseFrontmatter(data);
  if (!fm) {
    throw new Error(`Invalid frontmatter in ${file}`);
  }
  return { frontmatter: fm, content };
}

export function renderPreview(content: string, ratio: number): string {
  const safeRatio = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0.2;
  if (safeRatio >= 1) return content;

  const blocks = content
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length <= 1) {
    const lines = content.split("\n");
    const keep = Math.max(1, Math.ceil(lines.length * safeRatio));
    return lines.slice(0, keep).join("\n");
  }

  const keepBlocks = Math.max(1, Math.ceil(blocks.length * safeRatio));
  return blocks.slice(0, keepBlocks).join("\n\n");
}
