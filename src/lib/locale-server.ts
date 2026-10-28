import { cookies } from "next/headers";
import { LOCALE_COOKIE, parseLocale } from "@/lib/i18n";

export async function getLocale() {
  return parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}
