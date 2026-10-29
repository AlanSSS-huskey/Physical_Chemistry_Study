export type NavigationSearchHit = {
  slug: string;
  title: string;
  subjectTitle: string;
  locale: "zh" | "en";
  href: string;
  anchor: string | null;
  snippet: string;
};
export function searchShortcut(event: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
}) {
  return (
    !event.defaultPrevented &&
    !event.isComposing &&
    !event.altKey &&
    Boolean(event.metaKey || event.ctrlKey) &&
    event.key.toLowerCase() === "k"
  );
}
export function focusLoopTarget(
  active: number,
  count: number,
  backwards: boolean,
): number | null {
  if (count < 1) return null;
  if (active < 0) return backwards ? count - 1 : 0;
  if (backwards && active === 0) return count - 1;
  if (!backwards && active === count - 1) return 0;
  return null;
}
function readHit(raw: unknown): NavigationSearchHit {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("UNAVAILABLE");
  const hit = raw as Record<string, unknown>;
  if (
    typeof hit.slug !== "string" ||
    !/^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/.test(hit.slug) ||
    hit.slug.length > 240 ||
    typeof hit.title !== "string" ||
    typeof hit.subjectTitle !== "string" ||
    typeof hit.snippet !== "string" ||
    !["zh", "en"].includes(String(hit.locale)) ||
    (hit.anchor !== null && typeof hit.anchor !== "string")
  )
    throw new Error("UNAVAILABLE");
  const expected = `/notes/${hit.slug.split("/").map(encodeURIComponent).join("/")}${hit.anchor ? `#${encodeURIComponent(hit.anchor as string)}` : ""}`;
  if (hit.href !== expected) throw new Error("UNAVAILABLE");
  return {
    slug: hit.slug,
    title: hit.title,
    subjectTitle: hit.subjectTitle,
    locale: hit.locale as "zh" | "en",
    href: expected,
    anchor: hit.anchor as string | null,
    snippet: hit.snippet,
  };
}
export async function navigationSearch(
  query: string,
  locale: "zh" | "en",
  options: { signal?: AbortSignal; fetcher?: typeof fetch } = {},
) {
  const params = new URLSearchParams({ q: query.trim().slice(0, 200), locale });
  try {
    const response = await (options.fetcher ?? fetch)(`/api/search?${params}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: options.signal,
    });
    const result = await response.json();
    if (
      !response.ok ||
      result?.ok !== true ||
      !Array.isArray(result.data?.hits) ||
      typeof result.data.databaseAvailable !== "boolean"
    )
      throw new Error("UNAVAILABLE");
    return {
      hits: result.data.hits
        .slice(0, 100)
        .map(readHit) as NavigationSearchHit[],
      partial: !result.data.databaseAvailable,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error("UNAVAILABLE");
  }
}
