"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, getGoogleOAuthConfig } from "@/lib/auth";
import { clearAdminSession, hasAdminSession } from "@/lib/admin";

const ADMIN_CONTENT_FILE = path.join(process.cwd(), "content", "admin", "notes.md");
const MAX_CONTENT_LENGTH = 120_000;

export async function saveAdminNotes(formData: FormData) {
  const authConfigured = getGoogleOAuthConfig().configured;
  const user = await getCurrentUser();
  const principalId = authConfigured ? user?.id : "password-only-admin";
  if (!principalId || !(await hasAdminSession(principalId))) {
    redirect("/admin/login");
  }

  const raw = String(formData.get("content") ?? "");
  const content = raw.slice(0, MAX_CONTENT_LENGTH);

  await fs.mkdir(path.dirname(ADMIN_CONTENT_FILE), { recursive: true });
  await fs.writeFile(ADMIN_CONTENT_FILE, content, "utf8");

  revalidatePath("/admin");
  redirect("/admin?saved=1");
}

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/admin/login");
}
