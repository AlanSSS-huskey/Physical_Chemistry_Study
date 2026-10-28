export type ContentTranslation = {
  title: string;
  body: string;
  subjectTitle?: string;
};
export type ContentTranslations = {
  zh?: ContentTranslation;
  en?: ContentTranslation;
};

export type ContentInput = {
  title: string;
  slug: string;
  module: string | null;
  body: string;
  subjectSlug: string;
  chapterSlug: string;
  order: number;
  isPublic: boolean;
  isPublished: boolean;
  previewRatio: number;
  translations: ContentTranslations | null;
};

export class ContentValidationError extends Error {
  readonly code = "VALIDATION_ERROR";
  constructor(message: string) {
    super(message);
    this.name = "ContentValidationError";
  }
}

const SLUG = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/;
const SEGMENT = /^[a-z0-9][a-z0-9-]*$/;
export const MAX_CONTENT_LENGTH = 300_000;

export function isContentSlug(value: unknown): value is string {
  return typeof value === "string" && value.length <= 240 && SLUG.test(value);
}

/** Next may retain encoded separators from the old single-segment note route. */
export function noteSlugFromSegments(segments: string[]): string | null {
  try {
    const slug = segments
      .map((segment) => decodeURIComponent(segment))
      .join("/");
    return isContentSlug(slug) ? slug : null;
  } catch {
    return null;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(
  value: unknown,
  name: string,
  max: number,
  trim = true,
): string {
  if (typeof value !== "string")
    throw new ContentValidationError(`${name} must be text`);
  const result = trim ? value.trim() : value;
  if (result.length > max)
    throw new ContentValidationError(`${name} exceeds ${max} characters`);
  return result;
}

function parseTranslations(value: unknown): ContentTranslations {
  if (!record(value))
    throw new ContentValidationError("Translations must be an object");
  if (Object.keys(value).some((key) => key !== "zh" && key !== "en")) {
    throw new ContentValidationError(
      "Only zh and en translations are supported",
    );
  }
  const translations: ContentTranslations = {};
  for (const locale of ["zh", "en"] as const) {
    if (!(locale in value)) continue;
    const entry = value[locale];
    if (!record(entry))
      throw new ContentValidationError(
        `${locale} translation must be an object`,
      );
    translations[locale] = {
      title: stringField(entry.title ?? "", `${locale} title`, 240),
      body: stringField(
        entry.body ?? "",
        `${locale} body`,
        MAX_CONTENT_LENGTH,
        false,
      ),
      ...(entry.subjectTitle === undefined
        ? {}
        : {
            subjectTitle: stringField(
              entry.subjectTitle,
              `${locale} subject title`,
              160,
            ),
          }),
    };
  }
  return translations;
}

/** Accepts PATCH-style updates without resetting legacy publication or access settings. */
export function validateContentInput(
  payload: unknown,
  existing?: Record<string, unknown>,
): ContentInput {
  if (!record(payload))
    throw new ContentValidationError("Content must be a JSON object");
  const input = { ...existing, ...payload };
  const slug = stringField(input.slug ?? "", "Slug", 240).toLowerCase();
  if (!isContentSlug(slug))
    throw new ContentValidationError(
      "Slug must contain lowercase letters, numbers and hyphen-separated path segments",
    );
  let translations: ContentTranslations | null = null;
  if (existing?.translations && record(existing.translations))
    translations = parseTranslations(existing.translations);
  if (payload.translations !== undefined) {
    translations = {
      ...translations,
      ...parseTranslations(payload.translations),
    };
  }
  const complete = Object.values(translations ?? {}).find(
    (entry) => entry.title.trim() && entry.body.trim(),
  );
  const title =
    stringField(input.title ?? complete?.title ?? "", "Title", 240) ||
    complete?.title ||
    "";
  const body =
    stringField(
      input.body ?? complete?.body ?? "",
      "Body",
      MAX_CONTENT_LENGTH,
      false,
    ) ||
    complete?.body ||
    "";
  if (!title) throw new ContentValidationError("A title is required");
  const moduleValue =
    input.module === null || input.module === undefined
      ? ""
      : stringField(input.module, "Module", 120);
  const segments = slug.split("/");
  const subjectSlug = stringField(
    input.subjectSlug ?? (segments.length > 1 ? segments[0] : "notes"),
    "Subject",
    80,
  ).toLowerCase();
  const chapterSlug = stringField(
    input.chapterSlug ?? segments.at(-1) ?? slug,
    "Chapter",
    80,
  ).toLowerCase();
  if (!SEGMENT.test(subjectSlug) || !SEGMENT.test(chapterSlug))
    throw new ContentValidationError(
      "Subject and chapter must be valid lowercase path segments",
    );
  const order = input.order ?? 0;
  if (
    typeof order !== "number" ||
    !Number.isSafeInteger(order) ||
    order < 0 ||
    order > 100_000
  )
    throw new ContentValidationError(
      "Order must be an integer from 0 to 100000",
    );
  const isPublic = input.isPublic ?? true;
  const isPublished = input.isPublished ?? true;
  if (typeof isPublic !== "boolean" || typeof isPublished !== "boolean")
    throw new ContentValidationError(
      "Publication and visibility must be boolean values",
    );
  const previewRatio = input.previewRatio ?? 0.2;
  if (
    typeof previewRatio !== "number" ||
    !Number.isFinite(previewRatio) ||
    previewRatio < 0 ||
    previewRatio > 1
  )
    throw new ContentValidationError("Preview ratio must be between 0 and 1");
  if (isPublished) {
    if (!body.trim() && !complete)
      throw new ContentValidationError(
        "Published content requires a complete language version",
      );
    for (const entry of Object.values(translations ?? {})) {
      if (Boolean(entry.title.trim()) !== Boolean(entry.body.trim()))
        throw new ContentValidationError(
          "Published translations require both a title and body",
        );
    }
  }
  return {
    title,
    slug,
    module: moduleValue || null,
    body,
    subjectSlug,
    chapterSlug,
    order,
    isPublic,
    isPublished,
    previewRatio,
    translations,
  };
}

export function isTrustedMutationRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const requestUrl = new URL(request.url);
    const forwardedProtocol = request.headers.get("x-forwarded-proto");
    if (
      forwardedProtocol !== null &&
      forwardedProtocol !== "http" &&
      forwardedProtocol !== "https"
    )
      return false;
    const protocol =
      forwardedProtocol !== null
        ? `${forwardedProtocol}:`
        : requestUrl.protocol;
    if (protocol !== "http:" && protocol !== "https:") return false;
    // Next can use localhost internally while the browser addresses another
    // host. Bind to the real request authority, never an alternate forwarded host.
    const host = request.headers.get("host") ?? requestUrl.host;
    if (host.length > 300 || !/^[a-z0-9.[\]:-]+$/i.test(host)) return false;
    return origin === new URL(`${protocol}//${host}`).origin;
  } catch {
    return false;
  }
}

export async function parseContentJson(
  request: Request,
  maxBytes = 2_000_000,
): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new ContentValidationError("A JSON body is required");
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ContentValidationError("Request body is too large");
      }
      parts.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof ContentValidationError) throw error;
    throw new ContentValidationError("Invalid JSON");
  } finally {
    reader.releaseLock();
  }
}

export function contentApiFailure(error: unknown): Response {
  if (error instanceof ContentValidationError)
    return Response.json(
      { error: error.message, code: error.code },
      { status: 400 },
    );
  const code =
    error && typeof error === "object" && "code" in error ? error.code : null;
  if (code === "P2002")
    return Response.json(
      { error: "Slug already exists", code: "CONFLICT" },
      { status: 409 },
    );
  if (code === "P2025")
    return Response.json(
      { error: "Content not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  return Response.json(
    {
      error: "Content service is unavailable. Try again.",
      code: "UNAVAILABLE",
    },
    { status: 503 },
  );
}
