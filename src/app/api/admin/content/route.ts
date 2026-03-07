import { prisma } from "@/lib/db";
import { getAdminUserOrNull } from "@/lib/admin-access";

function normalizeSlug(input: string): string {
  const value = input.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(value)) {
    throw new Error("Invalid slug");
  }
  return value;
}

export async function POST(req: Request) {
  const user = await getAdminUserOrNull();
  if (!user) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = payload as Record<string, unknown>;
  const title = String(data.title ?? "").trim();
  const slug = normalizeSlug(String(data.slug ?? ""));
  const moduleValue = String(data.module ?? "").trim() || null;
  const body = String(data.body ?? "");

  if (!title) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }

  const exists = await prisma.content.findUnique({
    where: { slug },
    select: { id: true }
  });
  if (exists) {
    return Response.json({ error: "Slug already exists" }, { status: 409 });
  }

  const created = await prisma.content.create({
    data: {
      title,
      slug,
      module: moduleValue,
      body,
      subjectSlug: moduleValue ?? "notes",
      chapterSlug: slug,
      sourcePath: null,
      previewRatio: 1,
      isPublic: true
    },
    select: { id: true, slug: true }
  });

  return Response.json(created);
}
