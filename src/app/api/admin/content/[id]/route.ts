import { prisma } from "@/lib/db";
import { getAdminUserOrNull } from "@/lib/admin-access";

function normalizeSlug(input: string): string {
  const value = input.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(value)) {
    throw new Error("Invalid slug");
  }
  return value;
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUserOrNull();
  if (!user) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
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

  const duplicate = await prisma.content.findFirst({
    where: { slug, NOT: { id } },
    select: { id: true }
  });
  if (duplicate) {
    return Response.json({ error: "Slug already exists" }, { status: 409 });
  }

  const updated = await prisma.content.update({
    where: { id },
    data: {
      title,
      slug,
      module: moduleValue,
      body,
      subjectSlug: moduleValue ?? "notes",
      chapterSlug: slug
    },
    select: { id: true, slug: true }
  });

  return Response.json(updated);
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUserOrNull();
  if (!user) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  await prisma.content.delete({ where: { id } });
  return Response.json({ ok: true });
}
