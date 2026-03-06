import { MDXRemote } from "next-mdx-remote/rsc";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export function MdxRenderer({ source }: { source: string }) {
  return (
    <div className="prose prose-slate max-w-none text-slate-700">
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
