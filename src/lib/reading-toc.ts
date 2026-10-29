export type ReadingTocEntry = {
  id: string;
  text: string;
  level: 2 | 3;
  href: string;
};
export type ReadingLabelNode =
  | string
  | {
      tag: string;
      attributes: Record<string, string>;
      children: ReadingLabelNode[];
    };
function hasClass(node: Exclude<ReadingLabelNode, string>, name: string) {
  return (node.attributes.class ?? "").split(/\s+/).includes(name);
}
function annotation(node: ReadingLabelNode): string | null {
  if (typeof node === "string") return null;
  if (
    node.tag === "annotation" &&
    node.attributes.encoding === "application/x-tex"
  )
    return node.children.map(rawText).join("");
  for (const child of node.children) {
    const found = annotation(child);
    if (found !== null) return found;
  }
  return null;
}
function rawText(node: ReadingLabelNode): string {
  return typeof node === "string" ? node : node.children.map(rawText).join("");
}
function footnoteReference(node: ReadingLabelNode): boolean {
  return (
    typeof node !== "string" &&
    ("data-footnote-ref" in node.attributes ||
      "data-footnote-backref" in node.attributes ||
      hasClass(node, "footnote-ref") ||
      node.children.some(footnoteReference))
  );
}
/** Labels come from rendered visible structure; formula source is included once. */
export function readingHeadingLabel(node: ReadingLabelNode): string {
  const visibleText = (part: ReadingLabelNode): string => {
    if (typeof part === "string") return part;
    if (
      part.attributes["aria-hidden"] === "true" ||
      "hidden" in part.attributes ||
      hasClass(part, "sr-only") ||
      hasClass(part, "visually-hidden") ||
      ["script", "style"].includes(part.tag)
    )
      return "";
    if (part.tag === "sup" && footnoteReference(part)) return "";
    if (hasClass(part, "katex")) {
      const source = annotation(part);
      if (source !== null) return source;
    }
    if (part.tag === "annotation") return "";
    return part.children.map(visibleText).join("");
  };
  return visibleText(node).replace(/\s+/gu, " ").trim();
}
export function readingTocEntries(
  records: { id: string; text: string; level: number; visible: boolean }[],
): ReadingTocEntry[] {
  const seen = new Set<string>();
  const entries: ReadingTocEntry[] = [];
  for (const record of records) {
    const text = record.text.replace(/\s+/gu, " ").trim();
    if (
      !record.visible ||
      ![2, 3].includes(record.level) ||
      !record.id ||
      !text ||
      /[\s\x00-\x1f\x7f]/u.test(record.id) ||
      seen.has(record.id)
    )
      continue;
    let href: string;
    try {
      href = `#${encodeURIComponent(record.id)}`;
    } catch {
      continue;
    }
    seen.add(record.id);
    entries.push({ id: record.id, text, level: record.level as 2 | 3, href });
  }
  return entries;
}
export function activeReadingSection(
  entries: { id: string; top: number }[],
  offset = 140,
  viewport?: { atEnd: boolean; scrollY: number; height: number },
): string | null {
  const usable = entries.filter(
    (entry) => entry.id && Number.isFinite(entry.top),
  );
  const final = usable.at(-1);
  // A short final section cannot always reach the header marker. At the
  // document bottom, prefer that visible section after actual page scrolling.
  if (
    viewport?.atEnd &&
    viewport.scrollY > 0 &&
    final &&
    final.top < viewport.height
  )
    return final.id;
  return (
    usable.filter((entry) => entry.top <= offset).at(-1)?.id ||
    usable[0]?.id ||
    null
  );
}
