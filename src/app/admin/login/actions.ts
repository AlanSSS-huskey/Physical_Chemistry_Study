"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  createAdminSession,
  isAdminPasswordConfigured,
  verifyAdminPassword
} from "@/lib/admin";

export async function loginAdmin(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/api/auth/signin?callbackUrl=/admin/login");
  }

  if (!isAdminPasswordConfigured()) {
    redirect("/admin/login?error=config");
  }

  const password = String(formData.get("password") ?? "");
  if (!verifyAdminPassword(password)) {
    redirect("/admin/login?error=invalid");
  }

  await createAdminSession(user.id);
  redirect("/admin");
}
