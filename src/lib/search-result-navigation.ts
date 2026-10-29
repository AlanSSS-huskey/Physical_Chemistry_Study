export function searchResultNeedsReload(
  href: string,
  currentHref: string,
  currentLocale: string,
  resultLocale: string,
) {
  const current = new URL(currentHref);
  const target = new URL(href, current);
  return (
    currentLocale !== resultLocale &&
    target.origin === current.origin &&
    target.pathname === current.pathname &&
    target.search === current.search
  );
}
