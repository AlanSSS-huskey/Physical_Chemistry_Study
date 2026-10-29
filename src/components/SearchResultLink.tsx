"use client";

import type { ReactNode } from "react";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { requestStateNavigation } from "@/lib/navigation-guard";
import { searchResultNeedsReload } from "@/lib/search-result-navigation";

export function SearchResultLink({
  href,
  locale,
  children,
}: {
  href: string;
  locale: Locale;
  children: ReactNode;
}) {
  const { locale: currentLocale } = useLocale();
  return (
    <a
      href={href}
      onClick={(event) => {
        if (event.defaultPrevented) return;
        const reload =
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          searchResultNeedsReload(href, location.href, currentLocale, locale);
        if (reload && !requestStateNavigation(window)) {
          event.preventDefault();
          return;
        }
        document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
        if (reload) {
          event.preventDefault();
          // A hash-only navigation does not fetch the newly selected language.
          location.assign(href);
          location.reload();
        }
      }}
    >
      {children}
    </a>
  );
}
