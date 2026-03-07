import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { MdxRenderer } from "@/components/MdxRenderer";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function NotePage({ params }: Props) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  const content = await prisma.content.findUnique({
    where: { slug: decodedSlug },
    select: {
      title: true,
      module: true,
      body: true,
      updatedAt: true
    }
  });

  if (!content) {
    notFound();
  }

  return (
    <article className="mx-auto max-w-4xl space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {content.module ?? "Notes"}
        </div>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
          {content.title}
        </h1>
        <p className="mt-2 text-xs text-slate-500">
          Updated: {content.updatedAt.toLocaleString()}
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <MdxRenderer source={content.body} />
      </div>
    </article>
  );
}
