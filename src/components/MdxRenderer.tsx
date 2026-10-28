import { renderMarkdown } from "@/lib/markdown";

export async function MdxRenderer({ source }: { source: string }) {
  const html = await renderMarkdown(source);
  return (
    <div
      className="article-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
