"use server";

import { revalidatePath } from "next/cache";
import { ProgressStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function normalizeContentSlug(input: string): string {
  const slug = input.trim();
  const validSlug = /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/i;
  if (!validSlug.test(slug)) {
    throw new Error("Invalid content slug");
  }
  return slug;
}

export async function toggleChapterComplete(contentSlug: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  const normalizedContentSlug = normalizeContentSlug(contentSlug);
  const current = await prisma.progress.findUnique({
    where: {
      userId_contentSlug: { userId: user.id, contentSlug: normalizedContentSlug }
    },
    select: { status: true }
  });

  const nextStatus =
    current?.status === ProgressStatus.COMPLETED
      ? ProgressStatus.IN_PROGRESS
      : ProgressStatus.COMPLETED;

  await prisma.progress.upsert({
    where: {
      userId_contentSlug: { userId: user.id, contentSlug: normalizedContentSlug }
    },
    update: {
      status: nextStatus,
      completedAt: nextStatus === ProgressStatus.COMPLETED ? new Date() : null
    },
    create: {
      userId: user.id,
      contentSlug: normalizedContentSlug,
      status: nextStatus,
      completedAt: nextStatus === ProgressStatus.COMPLETED ? new Date() : null
    }
  });

  revalidatePath("/learn");
  revalidatePath(`/learn/${normalizedContentSlug}`);
}
