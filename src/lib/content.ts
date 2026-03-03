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

  await walk(CONTENT_ROOT);
  return out;
}

export async function getNavigationTree(): Promise<{ subjects: SubjectNavItem[] }> {
  const files = await listMdxFiles();
  const bySubject = new Map<string, SubjectNavItem>();

  for (const file of files) {
    const raw = await fs.readFile(file, "utf8");
    const { data } = matter(raw);
    const fm = data as Partial<ContentFrontmatter>;
    if (!fm.subject || !fm.subjectTitle || !fm.chapter || !fm.chapterTitle) continue;

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
    chapters: [...s.chapters].sort((a, b) => a.order - b.order)
  }));

  subjects.sort((a, b) => a.title.localeCompare(b.title));

  return { subjects };
}

export async function getMdxBySlug(params: {
  subject: string;
  chapter: string;
}): Promise<{ frontmatter: ContentFrontmatter; content: string }> {
  const file = path.join(CONTENT_ROOT, params.subject, `${params.chapter}.mdx`);
  const raw = await fs.readFile(file, "utf8");
  const { data, content } = matter(raw);
  const fm = data as ContentFrontmatter;
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

