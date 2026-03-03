import { MDXRemote } from "next-mdx-remote/rsc";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export function MdxRenderer({ source }: { source: string }) {
  return (
    <div className="prose prose-zinc max-w-none">
      <MDXRemote
        source={source}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkMath],
            rehypePlugins: [rehypeKatex]
          }
        }}
      />
    </div>
  );
}

