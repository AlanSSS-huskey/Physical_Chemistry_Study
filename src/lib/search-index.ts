import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { headingAnchor } from "./heading-anchors.ts";
import { normalizeMath } from "./markdown.ts";

type Locale = "zh" | "en";
export type SearchDocument = {
  slug: string;
  title: string;
  subjectSlug: string;
  subjectTitle: string;
  locale: Locale;
  body: string;
};
export type SearchHit = Omit<SearchDocument, "body"> & {
  href: string;
  snippet: string;
  anchor: string | null;
  score: number;
};
type MarkdownNode = {
  type: string;
  value?: string;
  alt?: string;
  depth?: number;
  children?: MarkdownNode[];
};
const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
function text(node: MarkdownNode): string {
  if (node.type === "html") return "";
  return node.value || node.alt || node.children?.map(text).join("") || "";
}
function blocks(body: string) {
  const tree = parser.parse(normalizeMath(body)) as MarkdownNode;
  const counts = new Map<string, number>();
  let anchor: string | null = null;
  const result: { text: string; anchor: string | null; heading: boolean }[] =
    [];
  function visit(node: MarkdownNode) {
    if (node.type === "html") return;
    if (node.type === "heading") {
      const title = text(node);
      anchor = headingAnchor(title, counts);
      result.push({ text: title, anchor, heading: true });
      return;
    }
    if (["paragraph", "code", "math", "tableRow"].includes(node.type)) {
      const value = text(node).replace(/\s+/g, " ").trim();
      if (value) result.push({ text: value, anchor, heading: false });
      return;
    }
    node.children?.forEach(visit);
  }
  visit(tree);
  return result;
}

/** The permission boundary is applied before any parsing, scoring or snippet. */
export function accessibleSearchBody(
  body: string,
  access: "full" | "preview" | "denied",
  ratio: number,
): string | null {
  if (access === "denied") return null;
  if (access === "full") return body;
  const safeRatio = Number.isFinite(ratio)
    ? Math.min(1, Math.max(0, ratio))
    : 0;
  if (safeRatio === 0) return "";
  const parts = body
    .split(/\n{2,}/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    const lines = body.split("\n");
    return lines
      .slice(0, Math.max(1, Math.ceil(lines.length * safeRatio)))
      .join("\n");
  }
  return parts
    .slice(0, Math.max(1, Math.ceil(parts.length * safeRatio)))
    .join("\n\n");
}

function snippet(value: string, terms: string[]): string {
  const lower = value.toLowerCase();
  const positions = terms
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0);
  const position = positions.length ? Math.min(...positions) : 0;
  const start = Math.max(0, position - 55);
  const end = Math.min(value.length, start + 210);
  return `${start ? "…" : ""}${value.slice(start, end)}${end < value.length ? "…" : ""}`;
}

export function searchDocuments(
  documents: SearchDocument[],
  query: string,
  locale: Locale,
  subject = "",
): SearchHit[] {
  const terms = query
    .trim()
    .slice(0, 200)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 12);
  if (!terms.length) return [];
  const hits = new Map<string, SearchHit>();
  for (const document of documents) {
    if (subject && document.subjectSlug !== subject) continue;
    const paragraphs = blocks(document.body);
    const title = document.title.toLowerCase();
    const all =
      `${title} ${document.subjectTitle} ${paragraphs.map((block) => block.text).join(" ")}`.toLowerCase();
    if (!terms.every((term) => all.includes(term))) continue;
    const ranked = paragraphs.map((block, index) => ({
      ...block,
      index,
      matches: terms.filter((term) => block.text.toLowerCase().includes(term))
        .length,
    }));
    ranked.sort(
      (a, b) =>
        b.matches - a.matches ||
        Number(a.heading) - Number(b.heading) ||
        a.index - b.index,
    );
    const best = ranked[0];
    const score =
      terms.filter((term) => title.includes(term)).length * 20 +
      (best?.matches || 0) * 4 +
      (document.locale === locale ? 1 : 0);
    const anchor = best?.anchor || null;
    const hit: SearchHit = {
      slug: document.slug,
      title: document.title,
      subjectSlug: document.subjectSlug,
      subjectTitle: document.subjectTitle,
      locale: document.locale,
      href: `/notes/${document.slug.split("/").map(encodeURIComponent).join("/")}${anchor ? `#${encodeURIComponent(anchor)}` : ""}`,
      snippet: snippet(best?.text || document.title, terms),
      anchor,
      score,
    };
    if (!hits.has(document.slug) || hits.get(document.slug)!.score < score)
      hits.set(document.slug, hit);
  }
  return [...hits.values()]
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))
    .slice(0, 100);
}
