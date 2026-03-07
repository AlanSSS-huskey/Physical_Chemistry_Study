import { serialize } from "next-mdx-remote/serialize";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import { getAdminUserOrNull } from "@/lib/admin-access";

const MAX_PREVIEW_LENGTH = 300_000;

export async function POST(req: Request) {
  const user = await getAdminUserOrNull();
  if (!user) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const source = String((payload as Record<string, unknown>).source ?? "").slice(
    0,
    MAX_PREVIEW_LENGTH
  );

  const mdx = await serialize(source, {
    mdxOptions: {
      remarkPlugins: [remarkGfm, remarkMath],
      rehypePlugins: [rehypeKatex]
    },
    parseFrontmatter: false
  });

  return Response.json({ mdx });
}
