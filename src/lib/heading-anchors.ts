/** Prefix generated heading ids so content cannot create browser-global names. */
export function headingAnchor(
  text: string,
  counts = new Map<string, number>(),
): string {
  const slug =
    text
      .normalize("NFKC")
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}_-]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "heading";
  const base = `section-${slug}`;
  const count = (counts.get(base) || 0) + 1;
  counts.set(base, count);
  return count === 1 ? base : `${base}-${count}`;
}

type HtmlNode = {
  type: string;
  tagName?: string;
  value?: string;
  children?: HtmlNode[];
  properties?: Record<string, unknown>;
};
function nodeText(node: HtmlNode): string {
  // Generated footnote numerals are not part of the authored heading text.
  if (node.type === "element" && node.tagName === "sup") return "";
  if (node.tagName === "img")
    return typeof node.properties?.alt === "string" ? node.properties.alt : "";
  return node.value || node.children?.map(nodeText).join("") || "";
}
export function addHeadingAnchors() {
  return (tree: HtmlNode) => {
    const counts = new Map<string, number>();
    function visit(node: HtmlNode) {
      if (node.type === "element" && /^h[1-6]$/.test(node.tagName || "")) {
        node.properties = {
          ...node.properties,
          id: headingAnchor(nodeText(node), counts),
        };
      }
      node.children?.forEach(visit);
    }
    visit(tree);
  };
}
