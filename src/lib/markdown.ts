import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import { addHeadingAnchors } from "./heading-anchors.ts";

export function normalizeMath(source: string): string {
  let fence: { marker: string; length: number } | null = null;
  return source
    .split("\n")
    .map((line) => {
      const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (marker) {
        if (!fence) fence = { marker: marker[1][0], length: marker[1].length };
        else if (
          marker[1][0] === fence.marker &&
          marker[1].length >= fence.length &&
          /^\s*$/.test(line.slice(marker[0].length))
        )
          fence = null;
        return line;
      }
      if (fence) return line;
      return line
        .split(/(`+[^`]*`+)/g)
        .map((part, index) =>
          index % 2
            ? part
            : part
                .replace(/\\\(/g, "$")
                .replace(/\\\)/g, "$")
                .replace(/\\\[/g, () => "\n$$\n")
                .replace(/\\\]/g, () => "\n$$\n"),
        )
        .join("");
    })
    .join("\n");
}

// Only Markdown enters the HTML tree. Sanitize before KaTeX adds its trusted
// generated markup, following rehype-sanitize's mathematical rendering guidance.
// Never evaluate JSX, imports or expressions from stored content.
export async function renderMarkdown(source: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeSanitize, {
      ...defaultSchema,
      attributes: {
        ...defaultSchema.attributes,
        code: [["className", /^language-./, "math-inline", "math-display"]],
      },
    })
    .use(addHeadingAnchors)
    .use(rehypeKatex, { trust: false, strict: "ignore" })
    .use(rehypeStringify)
    .process(normalizeMath(source));
  return String(result);
}
