"use server";

import { redirect } from "next/navigation";
import { getCurrentUser, getGoogleOAuthConfig } from "@/lib/auth";
import {
  createAdminSession,
  isAdminPasswordConfigured,
  verifyAdminPassword
} from "@/lib/admin";

export async function loginAdmin(formData: FormData) {
  const authConfigured = getGoogleOAuthConfig().configured;
  const user = await getCurrentUser();
  if (authConfigured && !user) {
    redirect("/api/auth/signin?callbackUrl=/admin/login");
  }
  const principalId = authConfigured ? user?.id : "password-only-admin";
  if (!principalId) {
    redirect("/admin/login?error=auth");
  }

  if (!isAdminPasswordConfigured()) {
    redirect("/admin/login?error=config");
  }

  const password = String(formData.get("password") ?? "");
  if (!verifyAdminPassword(password)) {
    redirect("/admin/login?error=invalid");
  }

  await createAdminSession(principalId);
  redirect("/admin");
}
