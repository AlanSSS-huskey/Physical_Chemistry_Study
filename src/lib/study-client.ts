import {
  defaultStudyPreferences,
  type StudyPreferences,
} from "./study-types.ts";

export class StudyRequestError extends Error {
  readonly code: string;
  readonly current: unknown;
  constructor(code: string, current?: unknown) {
    super(code);
    this.name = "StudyRequestError";
    this.code = code;
    this.current = current;
  }
}
export async function studyRequest<T>(
  path: string,
  userId: string,
  options: {
    method?: "GET" | "PUT";
    body?: Record<string, unknown>;
    signal?: AbortSignal;
    fetcher?: typeof fetch;
  } = {},
): Promise<T> {
  const { method = "GET", body, signal, fetcher = fetch } = options;
  try {
    const headers = new Headers({ "X-Study-User": userId });
    if (method !== "GET") {
      const csrfResponse = await fetcher("/api/account/csrf", {
        credentials: "same-origin",
        cache: "no-store",
        signal,
      });
      const csrf = await csrfResponse.json();
      if (!csrfResponse.ok || typeof csrf.csrfToken !== "string")
        throw new StudyRequestError("UNAVAILABLE");
      headers.set("X-CSRF-Token", csrf.csrfToken);
      headers.set("Content-Type", "application/json");
    }
    const response = await fetcher(path, {
      method,
      headers,
      credentials: "same-origin",
      cache: "no-store",
      signal,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true)
      throw new StudyRequestError(
        typeof result.code === "string" ? result.code : "UNAVAILABLE",
        result.current,
      );
    if (result.userId !== userId)
      throw new StudyRequestError("SESSION_CHANGED");
    return result.data as T;
  } catch (error) {
    if (
      error instanceof StudyRequestError ||
      (error instanceof Error && error.name === "AbortError")
    )
      throw error;
    throw new StudyRequestError("UNAVAILABLE");
  }
}
export function sameStudyValue(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
) {
  const omitMetadata = (record: Record<string, unknown>) =>
    JSON.stringify(
      Object.fromEntries(
        Object.entries(record)
          .filter(([key]) => !["revision", "updatedAt"].includes(key))
          .sort(([a], [b]) => a.localeCompare(b)),
      ),
    );
  return omitMetadata(left) === omitMetadata(right);
}
export function readAnonymousPreferences(raw: string | null): StudyPreferences {
  try {
    const value = JSON.parse(raw || "null");
    if (
      value &&
      Number.isInteger(value.fontSize) &&
      value.fontSize >= 16 &&
      value.fontSize <= 24 &&
      typeof value.lineHeight === "number" &&
      value.lineHeight >= 1.5 &&
      value.lineHeight <= 2.2 &&
      ["system", "light", "sepia", "dark"].includes(value.theme)
    )
      return {
        fontSize: value.fontSize,
        lineHeight: value.lineHeight,
        theme: value.theme,
        revision: 0,
      };
  } catch {
    /* Storage is optional; invalid values never become styles. */
  }
  return { ...defaultStudyPreferences };
}
export function readingSnapshot(
  offset: number,
  articleHeight: number,
  viewportHeight: number,
  headings: { id: string; top: number }[],
) {
  const distance = Math.max(1, articleHeight - viewportHeight);
  return {
    progress: Math.min(1, Math.max(0, offset / distance)),
    anchor:
      headings
        .filter((heading) => heading.id && heading.top <= offset + 120)
        .at(-1)?.id || null,
  };
}
