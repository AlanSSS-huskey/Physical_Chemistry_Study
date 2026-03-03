"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function toggleChapterComplete(contentSlug: string) {
  const session = await getSession();
  const user = session?.user as { id?: string } | undefined;
  if (!user?.id) {
    throw new Error("Not authenticated");
  }

  const current = await prisma.progress.findUnique({
    where: { userId_contentSlug: { userId: user.id, contentSlug } },
    select: { status: true }
  });

  const nextStatus = current?.status === "COMPLETED" ? "IN_PROGRESS" : "COMPLETED";

  await prisma.progress.upsert({
    where: { userId_contentSlug: { userId: user.id, contentSlug } },
    update: {
      status: nextStatus,
      completedAt: nextStatus === "COMPLETED" ? new Date() : null
    },
    create: {
      userId: user.id,
      contentSlug,
      status: nextStatus,
      completedAt: nextStatus === "COMPLETED" ? new Date() : null
    }
  });

  revalidatePath(`/learn/${contentSlug}`);
}

