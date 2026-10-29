import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountSettings } from "@/components/account/AccountSettings";
import { getSessionState } from "@/lib/auth";
import { getLocale } from "@/lib/locale-server";
import { textFor } from "@/lib/i18n";

export const metadata = {
  title: "Account settings",
};

export default async function AccountSettingsPage() {
  const [session, locale] = await Promise.all([getSessionState(), getLocale()]);
  if (session.status === "anonymous")
    redirect("/login?callbackUrl=%2Faccount%2Fsettings");
  if (session.status !== "authenticated")
    return (
      <div className="account-settings auth-stack">
        <h1 className="page-heading">
          {textFor(locale, "账户设置", "Account settings")}
        </h1>
        <p className="notice notice-error" role="status">
          {textFor(
            locale,
            "账户服务暂时不可用，无法读取设置。请稍后重试。",
            "Account settings are temporarily unavailable. Please try again shortly.",
          )}
        </p>
        <div>
          <Link className="button-secondary" href="/account/settings">
            {textFor(locale, "重新加载", "Try again")}
          </Link>
        </div>
      </div>
    );
  return <AccountSettings />;
}
