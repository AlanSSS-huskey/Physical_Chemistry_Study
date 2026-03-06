import { prisma } from "@/lib/db";
import { getCurrentUser, getGoogleOAuthConfig } from "@/lib/auth";
import { toggleChapterComplete } from "@/app/learn/[subject]/[chapter]/actions";
import Link from "next/link";

export async function MarkCompleteForm({ contentSlug }: { contentSlug: string }) {
  const authConfigured = getGoogleOAuthConfig().configured;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        {authConfigured ? (
          <>
            想要保存学习进度？请先{" "}
            <Link className="underline" href="/api/auth/signin">
              登录
            </Link>
            。
          </>
        ) : (
          <>学习进度需登录，登录功能待配置。</>
        )}
      </div>
    );
  }

  const progress = await prisma.progress.findUnique({
    where: { userId_contentSlug: { userId: user.id, contentSlug } },
    select: { status: true }
  });

  const isCompleted = progress?.status === "COMPLETED";

  return (
    <form action={toggleChapterComplete.bind(null, contentSlug)}>
      <button
        type="submit"
        className={
          isCompleted
            ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
            : "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
        }
      >
        {isCompleted ? "Marked complete (click to undo)" : "Mark as complete"}
      </button>
    </form>
  );
}
