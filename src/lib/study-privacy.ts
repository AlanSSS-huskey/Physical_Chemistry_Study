import { AccountError } from "./account-security.ts";
import type { StudyLocale } from "./study-types.ts";

export function assertStudyOwner(expected: string | null, actual: string) {
  if (expected !== actual) throw new AccountError("SESSION_CHANGED", 409);
}

export function studyCollectionItem(
  record: {
    contentSlug: string;
    locale?: string;
    body?: string;
    anchor?: string | null;
    progress?: number;
    updatedAt?: Date;
    createdAt?: Date;
  },
  readable: { title: string; subjectTitle: string } | null,
  requestedLocale: StudyLocale,
) {
  return {
    slug: record.contentSlug,
    locale:
      record.locale === "en"
        ? "en"
        : record.locale === "zh"
          ? "zh"
          : requestedLocale,
    available: Boolean(readable),
    title: readable?.title ?? null,
    subjectTitle: readable?.subjectTitle ?? null,
    updatedAt: record.updatedAt || record.createdAt,
    ...(record.body !== undefined
      ? { body: record.body, excerpt: record.body.slice(0, 240) }
      : {}),
    ...(record.progress !== undefined
      ? { progress: record.progress, anchor: record.anchor }
      : {}),
  };
}
