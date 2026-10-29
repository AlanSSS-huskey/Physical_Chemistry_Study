import { AccountError } from "./account-security.ts";
import type {
  StudyLocale,
  StudyNote,
  StudyPosition,
  StudyPreferences,
  StudyTheme,
} from "./study-types.ts";
export { defaultStudyPreferences } from "./study-types.ts";
export type {
  StudyLocale,
  StudyNote,
  StudyPosition,
  StudyPreferences,
  StudyTheme,
} from "./study-types.ts";

function invalid(): never {
  throw new AccountError("VALIDATION_ERROR", 400);
}
function revision(value: unknown): number {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < 0 ||
    Number(value) > 2147483646
  )
    invalid();
  return value as number;
}
export function validateStudyIdentity(input: Record<string, unknown>) {
  if (
    typeof input.slug !== "string" ||
    input.slug.length > 240 ||
    !/^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/.test(input.slug) ||
    !["zh", "en"].includes(String(input.locale))
  )
    invalid();
  return { contentSlug: input.slug, locale: input.locale as StudyLocale };
}
export function validateStudyNote(input: Record<string, unknown>): StudyNote {
  if (
    typeof input.body !== "string" ||
    input.body.length > 5000 ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(input.body)
  )
    invalid();
  return { body: input.body, revision: revision(input.revision) };
}
export function validateStudyPosition(
  input: Record<string, unknown>,
): StudyPosition {
  if (
    typeof input.progress !== "number" ||
    !Number.isFinite(input.progress) ||
    input.progress < 0 ||
    input.progress > 1
  )
    invalid();
  if (
    input.anchor !== null &&
    (typeof input.anchor !== "string" ||
      input.anchor.length > 160 ||
      /[\x00-\x1f\x7f]/.test(input.anchor))
  )
    invalid();
  return {
    progress: input.progress,
    anchor: input.anchor as string | null,
    revision: revision(input.revision),
  };
}
export function validateStudyPreferences(
  input: Record<string, unknown>,
): StudyPreferences {
  if (
    !Number.isInteger(input.fontSize) ||
    Number(input.fontSize) < 16 ||
    Number(input.fontSize) > 24 ||
    typeof input.lineHeight !== "number" ||
    !Number.isFinite(input.lineHeight) ||
    input.lineHeight < 1.5 ||
    input.lineHeight > 2.2 ||
    !["system", "light", "sepia", "dark"].includes(String(input.theme))
  )
    invalid();
  return {
    fontSize: input.fontSize as number,
    lineHeight: input.lineHeight,
    theme: input.theme as StudyTheme,
    revision: revision(input.revision),
  };
}

export class StudyConflict<T = unknown> extends AccountError {
  readonly current: T | null;
  constructor(current: T | null) {
    super("CONFLICT", 409);
    this.current = current;
  }
}
export async function saveStudyRevision<T extends { revision: number }, V>(
  store: {
    read(): Promise<T | null>;
    create(value: V & { revision: number }): Promise<T>;
    update(expectedRevision: number, value: V): Promise<boolean>;
  },
  value: V,
  expectedRevision: number,
): Promise<T> {
  if (expectedRevision === 0) {
    try {
      return await store.create({ ...value, revision: 1 });
    } catch (error) {
      if (!(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ))
        throw error;
    }
  } else if (await store.update(expectedRevision, value)) {
    const saved = await store.read();
    if (saved) return saved;
  }
  throw new StudyConflict(await store.read());
}
