export function privateLibraryQuery(
  kind: "bookmarks" | "notes" | "recent",
  page: number,
  locale: "zh" | "en",
  query = "",
) {
  const url = new URL("/api/study/library", "https://private-library.invalid");
  url.searchParams.set("kind", kind);
  url.searchParams.set("page", String(page));
  url.searchParams.set("locale", locale);
  const trimmed = query.trim().slice(0, 200);
  if (kind === "notes" && trimmed) url.searchParams.set("q", trimmed);
  return url;
}
