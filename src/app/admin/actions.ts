"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { clearAdminSession, hasAdminSession } from "@/lib/admin";

const ADMIN_CONTENT_FILE = path.join(process.cwd(), "content", "admin", "notes.md");
const MAX_CONTENT_LENGTH = 120_000;

export async function saveAdminNotes(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !(await hasAdminSession(user.id))) {
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
