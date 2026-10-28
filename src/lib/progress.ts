import { prisma } from "@/lib/db";
import { isDatabaseConfigured, logAuthFailure } from "@/lib/auth";
import { loadContent } from "@/lib/content-service";
import { resolveContentAccess } from "@/lib/content-access";
import type { Locale } from "@/lib/i18n";
import {
  updateAuthorizedProgress,
  validateProgressInput,
} from "@/lib/progress-validation";
import type { ProgressUpdateResult } from "@/lib/progress-validation";

export type ProgressRecord = {
  contentSlug: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  completedAt: Date | null;
  updatedAt: Date;
};

export async function loadUserProgress(
  userId: string,
): Promise<{ available: boolean; items: ProgressRecord[] }> {
  if (!isDatabaseConfigured()) return { available: false, items: [] };
  try {
    const items = await prisma.progress.findMany({
      where: { userId },
      select: {
        contentSlug: true,
        status: true,
        completedAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    return { available: true, items };
  } catch (error) {
    logAuthFailure("PROGRESS_READ", error);
    return { available: false, items: [] };
  }
}

export async function loadChapterProgress(
  userId: string,
  contentSlug: string,
): Promise<{ available: boolean; completed: boolean }> {
  const input = validateProgressInput(contentSlug, true);
  if (!input || !isDatabaseConfigured())
    return { available: false, completed: false };
  try {
    const progress = await prisma.progress.findUnique({
      where: { userId_contentSlug: { userId, contentSlug: input.contentSlug } },
      select: { status: true },
    });
    return { available: true, completed: progress?.status === "COMPLETED" };
  } catch (error) {
    logAuthFailure("CHAPTER_PROGRESS_READ", error);
    return { available: false, completed: false };
  }
}

export async function saveChapterProgress(
  contentSlug: unknown,
  completed: unknown,
  userId: string | null,
  locale: Locale,
): Promise<ProgressUpdateResult> {
  try {
    return await updateAuthorizedProgress(contentSlug, completed, userId, {
      async resolveAccess(slug, currentUserId) {
        const { content, databaseAvailable } = await loadContent(slug, locale);
        // A bundled fallback cannot prove that a database override is public.
        if (!databaseAvailable) return "unavailable";
        if (!content?.isPublished) return "denied";
        return resolveContentAccess(content, currentUserId);
      },
      async save(currentUserId, slug, status) {
        const completedAt = status === "COMPLETED" ? new Date() : null;
        // The conditional update preserves completedAt and updatedAt on retries.
        await prisma.$transaction([
          prisma.progress.createMany({
            data: [
              { userId: currentUserId, contentSlug: slug, status, completedAt },
            ],
            skipDuplicates: true,
          }),
          prisma.progress.updateMany({
            where: {
              userId: currentUserId,
              contentSlug: slug,
              status: { not: status },
            },
            data: { status, completedAt },
          }),
        ]);
      },
    });
  } catch (error) {
    logAuthFailure("PROGRESS_WRITE", error);
    return { ok: false, error: "unavailable" };
  }
}
