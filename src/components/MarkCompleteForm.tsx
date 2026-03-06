import { prisma } from "@/lib/db";
import { getCurrentUser, getGoogleOAuthConfig } from "@/lib/auth";
import { toggleChapterComplete } from "@/app/learn/[subject]/[chapter]/actions";
import Link from "next/link";

export async function MarkCompleteForm({ contentSlug }: { contentSlug: string }) {
  const authConfigured = getGoogleOAuthConfig().configured;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="rounded-md border bg-zinc-50 p-3 text-sm text-zinc-700">
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
            ? "rounded-md border bg-green-50 px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-100"
            : "rounded-md border px-3 py-2 text-sm font-medium hover:bg-zinc-50"
        }
      >
        {isCompleted ? "Marked complete (click to undo)" : "Mark as complete"}
      </button>
    </form>
  );
}
