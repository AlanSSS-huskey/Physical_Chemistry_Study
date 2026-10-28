"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, logAuthFailure } from "@/lib/auth";
import { getLocale } from "@/lib/locale-server";
import { saveChapterProgress } from "@/lib/progress";
import { validateProgressInput } from "@/lib/progress-validation";
import type { ProgressUpdateResult } from "@/lib/progress-validation";

export async function setChapterComplete(
  contentSlug: string,
  completed: boolean,
): Promise<ProgressUpdateResult> {
  if (!validateProgressInput(contentSlug, completed))
    return { ok: false, error: "invalid" };
  try {
    const user = await getCurrentUser();
    const result = await saveChapterProgress(
      contentSlug,
      completed,
      user?.id ?? null,
      await getLocale(),
    );
    if (result.ok) {
      const slug = validateProgressInput(contentSlug, completed)!.contentSlug;
      for (const path of [
        "/",
        "/account",
        "/learn",
        "/notes",
        `/learn/${slug}`,
        `/notes/${slug}`,
      ])
        revalidatePath(path);
    }
    return result;
  } catch (error) {
    logAuthFailure("PROGRESS_ACTION", error);
    return { ok: false, error: "unavailable" };
  }
}
