"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminUser } from "@/lib/admin-access";

export async function deleteContentById(formData: FormData) {
  await requireAdminUser();
  const id = String(formData.get("id") ?? "");
  if (!id) {
    redirect("/admin?error=missing-id");
  }

  await prisma.content.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath("/notes");
  redirect("/admin?deleted=1");
}
