"use client";

import type { ReactNode } from "react";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";

export function SearchResultLink({
  href,
  locale,
  children,
}: {
  href: string;
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      onClick={() => {
        document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      }}
    >
      {children}
    </a>
  );
}
