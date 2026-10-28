import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleSignInButton } from "@/components/AuthNav";
import { getSessionState } from "@/lib/auth";
import { safeCallbackPath } from "@/lib/auth-config";
import { getLocale } from "@/lib/locale-server";
import { textFor } from "@/lib/i18n";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const [params, locale, session] = await Promise.all([
    searchParams,
    getLocale(),
    getSessionState(),
  ]);
  const callbackUrl = safeCallbackPath(params.callbackUrl);
  if (session.status === "authenticated" && !params.error)
    redirect(callbackUrl);
  const unavailable =
    session.status === "unavailable" || params.error === "unavailable";
  const unconfigured = session.status === "unconfigured";

  return (
    <div className="mx-auto max-w-xl space-y-8 py-8 md:py-16">
      <div className="space-y-3">
        <p className="eyebrow">
          {textFor(locale, "个人学习空间", "YOUR STUDY SPACE")}
        </p>
        <h1 className="page-heading">
          {textFor(locale, "登录，继续你的学习", "Sign in and keep learning")}
        </h1>
        <p className="muted">
          {textFor(
            locale,
            "保存章节进度，随时继续阅读。中英文版本共享同一份学习记录。",
            "Save chapter progress and pick up where you left off. Your Chinese and English reading progress stays together.",
          )}
        </p>
      </div>
      <section
        className="panel space-y-5 p-6 md:p-8"
        aria-label={textFor(locale, "登录", "Sign in")}
      >
        {unconfigured ? (
          <div className="notice" role="status">
            {textFor(
              locale,
              "登录服务尚未配置。网站负责人完成设置后，你就可以使用 Google 登录并保存进度。",
              "Sign-in has not been configured yet. Once the site owner finishes setup, you can use Google to sign in and save progress.",
            )}
          </div>
        ) : unavailable ? (
          <>
            <div className="notice notice-error" role="status">
              {textFor(
                locale,
                "登录服务暂时不可用，暂时无法验证身份或读取账户。请稍后重试。",
                "Sign-in is temporarily unavailable, so your account could not be verified. Please try again shortly.",
              )}
            </div>
            <Link
              className="button-secondary"
              href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            >
              {textFor(locale, "重试", "Try again")}
            </Link>
          </>
        ) : (
          <>
            {params.error && (
              <div className="notice notice-error" role="alert">
                {textFor(
                  locale,
                  "这次登录未能完成。请重试，或选择与你已有账户相同的 Google 账号。",
                  "Sign-in could not be completed. Try again using the Google account associated with your existing account.",
                )}
              </div>
            )}
            <GoogleSignInButton callbackUrl={callbackUrl} />
            <p className="muted text-sm">
              {textFor(
                locale,
                "通过 Google 安全登录，无需另设密码。",
                "Sign in securely with Google. No separate password is needed.",
              )}
            </p>
          </>
        )}
        <div className="border-t pt-5">
          <Link className="button-ghost" href="/learn">
            {textFor(locale, "先浏览学习内容 →", "Browse the library first →")}
          </Link>
        </div>
      </section>
    </div>
  );
}
