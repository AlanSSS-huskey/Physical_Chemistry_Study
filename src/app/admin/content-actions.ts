"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminUser } from "@/lib/admin-access";
import { isBundledContent } from "@/lib/content-service";
import { contentHref } from "@/lib/i18n";

export async function deleteContentById(formData: FormData) {
  try {
    await requireAdminUser();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) redirect("/admin?error=missing-id");
    const content = await prisma.content.findUnique({
      where: { id },
      select: { slug: true },
    });
    if (!content) redirect("/admin?error=missing-content");
    if (await isBundledContent(content.slug)) redirect("/admin?error=bundled");
    const deleted = await prisma.content.delete({
      where: { id },
      select: { slug: true, subjectSlug: true, chapterSlug: true },
    });
    revalidatePath("/admin");
    revalidatePath("/notes");
    revalidatePath(contentHref(deleted.slug));
    revalidatePath("/learn");
    if (deleted.subjectSlug && deleted.chapterSlug)
      revalidatePath(
        `/learn/${encodeURIComponent(deleted.subjectSlug)}/${encodeURIComponent(deleted.chapterSlug)}`,
      );
  } catch (error) {
    unstable_rethrow(error);
    redirect("/admin?error=unavailable");
  }
  redirect("/admin?deleted=1");
}
