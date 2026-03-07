import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { getAdminUserOrNull } from "@/lib/admin-access";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function sanitizeBaseName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  const cleaned = base.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-");
  return cleaned.replace(/^-+|-+$/g, "") || "image";
}

function extensionByType(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(req: Request) {
  const user = await getAdminUserOrNull();
  if (!user) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const input = formData.get("file");
  if (!(input instanceof File)) {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(input.type)) {
    return Response.json({ error: "Invalid file type. Use jpg/jpeg/png/webp." }, { status: 400 });
  }

  if (input.size > MAX_IMAGE_SIZE) {
    return Response.json({ error: "File is too large. Max size is 5MB." }, { status: 400 });
  }

  const ext = extensionByType(input.type);
  const safeName = sanitizeBaseName(input.name);
  const filename = `${Date.now()}-${randomBytes(4).toString("hex")}-${safeName}.${ext}`;

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  const absoluteFile = path.join(uploadDir, filename);
  await fs.mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await input.arrayBuffer());
  await fs.writeFile(absoluteFile, buffer);

  const url = `/uploads/${filename}`;
  await prisma.imageAsset.create({
    data: {
      filename,
      url,
      size: input.size,
      uploadedBy: user.id
    }
  });

  return Response.json({ url });
}
