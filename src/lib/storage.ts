import { randomUUID } from "node:crypto";

if (typeof window !== "undefined")
  throw new Error("Storage credentials are server-only");

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export type StorageConfig = { url: string; key: string; bucket: string };
type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
export type ImageUpload = {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
  userId: string;
};

export class StorageError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status = 400, code = "VALIDATION_ERROR") {
    super(message);
    this.name = "StorageError";
    this.status = status;
    this.code = code;
  }
}

export async function readImageFormData(request: Request): Promise<FormData> {
  const limit = MAX_IMAGE_SIZE + 65_536;
  const reader = request.body?.getReader();
  if (!reader) throw new StorageError("No image was uploaded");
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new StorageError("Image exceeds the 5 MB limit", 413);
      }
      parts.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.byteLength;
    }
    return await new Response(bytes, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch (error) {
    if (error instanceof StorageError) throw error;
    throw new StorageError("Invalid image upload");
  } finally {
    reader.releaseLock();
  }
}

export function validateImage(
  bytes: Uint8Array,
  mimeType: string,
): { extension: string } {
  if (bytes.length === 0) throw new StorageError("Image is empty");
  if (bytes.length > MAX_IMAGE_SIZE)
    throw new StorageError("Image exceeds the 5 MB limit", 413);
  const png = [137, 80, 78, 71, 13, 10, 26, 10];
  const matchesPng =
    bytes.length >= 24 &&
    png.every((byte, index) => bytes[index] === byte) &&
    bytes[12] === 73 &&
    bytes[13] === 72 &&
    bytes[14] === 68 &&
    bytes[15] === 82;
  const matchesJpeg =
    bytes.length >= 4 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255 &&
    bytes.at(-2) === 255 &&
    bytes.at(-1) === 217;
  const text = (start: number, length: number) =>
    String.fromCharCode(...bytes.subarray(start, start + length));
  const matchesWebp =
    bytes.length >= 16 &&
    text(0, 4) === "RIFF" &&
    text(8, 4) === "WEBP" &&
    ["VP8 ", "VP8L", "VP8X"].includes(text(12, 4));
  if (mimeType === "image/png" && matchesPng) return { extension: "png" };
  if (mimeType === "image/jpeg" && matchesJpeg) return { extension: "jpg" };
  if (mimeType === "image/webp" && matchesWebp) return { extension: "webp" };
  throw new StorageError(
    "Image type does not match its PNG, JPEG or WebP signature",
  );
}

export function getStorageConfig(
  env: Record<string, string | undefined> = process.env,
): StorageConfig {
  const key = (
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SECRET_KEY ||
    ""
  ).trim();
  const bucket = (env.SUPABASE_STORAGE_BUCKET || "chemistry-images").trim();
  let url: URL;
  try {
    url = new URL(env.SUPABASE_URL || "");
  } catch {
    throw new StorageError(
      "Image storage is not configured",
      503,
      "STORAGE_UNAVAILABLE",
    );
  }
  if (
    !key ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(bucket)
  ) {
    throw new StorageError(
      "Image storage is not configured correctly",
      503,
      "STORAGE_UNAVAILABLE",
    );
  }
  return { url: url.href.replace(/\/$/, ""), key, bucket };
}

function headers(config: StorageConfig): Record<string, string> {
  return { Authorization: `Bearer ${config.key}`, apikey: config.key };
}

function encodedPath(objectPath: string): string {
  if (
    objectPath.length > 500 ||
    !/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/.test(objectPath) ||
    objectPath.split("/").some((part) => part === "." || part === "..")
  ) {
    throw new StorageError("Invalid image object path");
  }
  return objectPath.split("/").map(encodeURIComponent).join("/");
}

async function storageRequest(
  url: string,
  init: RequestInit,
  fetcher: Fetcher,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetcher(url, {
      ...init,
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new StorageError(
      "Image storage could not be reached",
      503,
      "STORAGE_UNAVAILABLE",
    );
  }
  if (!response.ok)
    throw new StorageError(
      "Image storage request failed",
      503,
      "STORAGE_UNAVAILABLE",
    );
  return response;
}

export async function uploadImageObject(
  input: ImageUpload,
  config = getStorageConfig(),
  fetcher: Fetcher = fetch,
) {
  const { extension } = validateImage(input.bytes, input.mimeType);
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(input.userId))
    throw new StorageError("Invalid image owner");
  const basename = (input.filename.split(/[\\/]/).at(-1) || "image").replace(
    /\.[^.]+$/,
    "",
  );
  const safeName =
    basename
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "image";
  const filename = `${randomUUID()}-${safeName}.${extension}`;
  const objectPath = `${input.userId}/${filename}`;
  await storageRequest(
    `${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}/${encodedPath(objectPath)}`,
    {
      method: "POST",
      headers: {
        ...headers(config),
        "Content-Type": input.mimeType,
        "x-upsert": "false",
        "Cache-Control": "max-age=31536000",
      },
      body: new Uint8Array(input.bytes).buffer,
    },
    fetcher,
  );
  return {
    path: objectPath,
    filename,
    size: input.bytes.length,
    mimeType: input.mimeType,
    url: `${config.url}/storage/v1/object/public/${encodeURIComponent(config.bucket)}/${encodedPath(objectPath)}`,
  };
}

export async function deleteImageObject(
  objectPath: string,
  config = getStorageConfig(),
  fetcher: Fetcher = fetch,
): Promise<void> {
  encodedPath(objectPath);
  await storageRequest(
    `${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}`,
    {
      method: "DELETE",
      headers: { ...headers(config), "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [objectPath] }),
    },
    fetcher,
  );
}

export async function readImageObject(
  objectPath: string,
  config = getStorageConfig(),
  fetcher: Fetcher = fetch,
): Promise<Response> {
  return storageRequest(
    `${config.url}/storage/v1/object/authenticated/${encodeURIComponent(config.bucket)}/${encodedPath(objectPath)}`,
    {
      method: "GET",
      headers: headers(config),
      cache: "no-store",
    },
    fetcher,
  );
}

type ImageMetadata = {
  id: string;
  filename: string;
  url: string;
  size: number;
  uploadedBy: string;
  storagePath: string;
  mimeType: string;
};

/** Persist metadata only after upload, and remove the object if the database write fails. */
export async function uploadAndPersistImage<T>(
  input: ImageUpload,
  persist: (metadata: ImageMetadata) => Promise<T>,
  config = getStorageConfig(),
  fetcher: Fetcher = fetch,
): Promise<T> {
  const uploaded = await uploadImageObject(input, config, fetcher);
  const id = randomUUID();
  try {
    return await persist({
      id,
      filename: uploaded.filename,
      url: `/api/images/${id}`,
      size: uploaded.size,
      uploadedBy: input.userId,
      storagePath: uploaded.path,
      mimeType: uploaded.mimeType,
    });
  } catch {
    try {
      await deleteImageObject(uploaded.path, config, fetcher);
    } catch {
      throw new StorageError(
        "Image metadata could not be saved and storage cleanup failed",
        503,
        "STORAGE_CLEANUP_FAILED",
      );
    }
    throw new StorageError(
      "Image metadata could not be saved. Try again.",
      503,
      "UNAVAILABLE",
    );
  }
}
