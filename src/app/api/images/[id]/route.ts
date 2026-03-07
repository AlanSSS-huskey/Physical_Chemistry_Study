import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { getAdminUserOrNull } from "@/lib/admin-access";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUserOrNull();
  if (!user) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const asset = await prisma.imageAsset.findUnique({
    where: { id },
    select: { filename: true, id: true }
  });

  if (!asset) {
    return Response.json({ error: "Image not found" }, { status: 404 });
  }

  await prisma.imageAsset.delete({ where: { id: asset.id } });

  const filepath = path.join(process.cwd(), "public", "uploads", asset.filename);
  try {
    await fs.unlink(filepath);
  } catch {
    // Ignore missing file.
  }

  return Response.json({ ok: true });
}
