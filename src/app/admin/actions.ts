"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, getGoogleOAuthConfig } from "@/lib/auth";
import { clearAdminSession, hasAdminSession } from "@/lib/admin";

const ADMIN_CONTENT_FILE = path.join(process.cwd(), "content", "admin", "notes.md");
const CONTENT_ROOT = path.join(process.cwd(), "content");
const MAX_CONTENT_LENGTH = 120_000;
const MAX_CHAPTER_LENGTH = 300_000;

function normalizeSlug(input: string): string {
  const value = input.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(value)) {
    throw new Error("Invalid slug");
  }
  return value;
}

async function requireAdminPrincipal(): Promise<string> {
  const authConfigured = getGoogleOAuthConfig().configured;
  const user = await getCurrentUser();
  const principalId = authConfigured ? user?.id : "password-only-admin";
  if (!principalId || !(await hasAdminSession(principalId))) {
    redirect("/admin/login");
  }
  return principalId;
}

export async function saveAdminNotes(formData: FormData) {
  await requireAdminPrincipal();

  const raw = String(formData.get("content") ?? "");
  const content = raw.slice(0, MAX_CONTENT_LENGTH);

  await fs.mkdir(path.dirname(ADMIN_CONTENT_FILE), { recursive: true });
  await fs.writeFile(ADMIN_CONTENT_FILE, content, "utf8");

  revalidatePath("/admin");
  redirect("/admin?saved=1");
}

export async function createAdminChapter(formData: FormData) {
  await requireAdminPrincipal();

  const subject = normalizeSlug(String(formData.get("subject") ?? ""));
  const chapter = normalizeSlug(String(formData.get("chapter") ?? ""));
  const subjectTitle = String(formData.get("subjectTitle") ?? "").trim() || subject;
  const chapterTitle = String(formData.get("chapterTitle") ?? "").trim() || chapter;
  const moduleKeyRaw = String(formData.get("moduleKey") ?? "").trim();
  const previewRatioRaw = String(formData.get("previewRatio") ?? "").trim();
  const chapterContent = String(formData.get("chapterContent") ?? "").slice(0, MAX_CHAPTER_LENGTH);

  const previewRatio = previewRatioRaw ? Number.parseFloat(previewRatioRaw) : undefined;
  const safePreview =
    previewRatio === undefined || Number.isNaN(previewRatio)
      ? undefined
      : Math.min(1, Math.max(0, previewRatio));

  const lines = [
    "---",
    `subject: ${subject}`,
    `subjectTitle: "${subjectTitle.replaceAll("\"", "\\\"")}"`,
    `chapter: ${chapter}`,
    `chapterTitle: "${chapterTitle.replaceAll("\"", "\\\"")}"`
  ];

  if (moduleKeyRaw) lines.push(`moduleKey: ${moduleKeyRaw}`);
  if (safePreview !== undefined) lines.push(`previewRatio: ${safePreview}`);
  lines.push("---", "", chapterContent || "在这里写章节内容...");

  const file = path.join(CONTENT_ROOT, subject, `${chapter}.mdx`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${lines.join("\n")}\n`, "utf8");

  revalidatePath("/learn");
  revalidatePath(`/learn/${subject}/${chapter}`);
  revalidatePath("/admin");
  redirect(`/admin?subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}&saved=chapter`);
}

export async function saveAdminChapterRaw(formData: FormData) {
  await requireAdminPrincipal();

  const subject = normalizeSlug(String(formData.get("subject") ?? ""));
  const chapter = normalizeSlug(String(formData.get("chapter") ?? ""));
  const raw = String(formData.get("raw") ?? "").slice(0, MAX_CHAPTER_LENGTH);
  const file = path.join(CONTENT_ROOT, subject, `${chapter}.mdx`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, raw, "utf8");

  revalidatePath("/learn");
  revalidatePath(`/learn/${subject}/${chapter}`);
  revalidatePath("/admin");
  redirect(`/admin?subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}&saved=chapter`);
}

export async function deleteAdminChapter(formData: FormData) {
  await requireAdminPrincipal();

  const subject = normalizeSlug(String(formData.get("subject") ?? ""));
  const chapter = normalizeSlug(String(formData.get("chapter") ?? ""));
  const file = path.join(CONTENT_ROOT, subject, `${chapter}.mdx`);
  try {
    await fs.unlink(file);
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  revalidatePath("/learn");
  revalidatePath(`/learn/${subject}/${chapter}`);
  revalidatePath("/admin");
  redirect("/admin?deleted=chapter");
}

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/admin/login");
}
