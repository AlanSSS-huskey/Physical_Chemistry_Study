export type Locale = "zh" | "en";

export const LOCALE_COOKIE = "chemistry-locale";

export function parseLocale(value: unknown): Locale {
  return value === "en" ? "en" : "zh";
}

export function textFor(locale: Locale, zh: string, en: string): string {
  return locale === "zh" ? zh : en;
}

export function formatDate(
  value: string | Date | null,
  locale: Locale,
): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function contentHref(slug: string): string {
  return `/notes/${slug.split("/").map(encodeURIComponent).join("/")}`;
}
