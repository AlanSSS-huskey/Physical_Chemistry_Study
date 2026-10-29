import { AccountError } from "./account-security.ts";
export type AccountMail = {
  to: string;
  locale: "zh" | "en";
} & (
  | { purpose: "ACCOUNT_HELP"; token?: never }
  | {
      purpose: "VERIFY_EMAIL" | "RESET_PASSWORD" | "SET_PASSWORD";
      token: string;
    }
);
type Environment = Record<string, string | undefined>;
function mailConfig(env: Environment) {
  try {
    const url = new URL(env.NEXTAUTH_URL || "");
    const key = env.RESEND_API_KEY?.trim();
    const from = (env.EMAIL_FROM || env.AUTH_EMAIL_FROM)?.trim();
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      !key ||
      !from ||
      /[\r\n]/.test(from) ||
      (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      url.username ||
      url.password
    )
      return null;
    return { origin: url.origin, key, from };
  } catch {
    return null;
  }
}
export function accountMailReady(env: Environment = process.env): boolean {
  return Boolean(mailConfig(env));
}
export async function sendAccountMail(
  mail: AccountMail,
  env: Environment = process.env,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const config = mailConfig(env);
  if (!config) throw new AccountError("MAIL_UNAVAILABLE", 503);
  const zh = mail.locale === "zh";
  const help = mail.purpose === "ACCOUNT_HELP";
  const verify = mail.purpose === "VERIFY_EMAIL";
  const set = mail.purpose === "SET_PASSWORD";
  const link = help
    ? `${config.origin}/login`
    : `${config.origin}/${verify ? "verify-email" : "reset-password"}#token=${encodeURIComponent(mail.token)}`;
  const subject = help
    ? zh
      ? "你的学习账号帮助"
      : "Your study account help"
    : verify
      ? zh
        ? "验证你的物理化学学习账号"
        : "Verify your Physical Chemistry account"
      : set
        ? zh
          ? "为你的学习账号设置密码"
          : "Set a password for your study account"
        : zh
          ? "重置你的学习账号密码"
          : "Reset your study account password";
  const text = help
    ? zh
      ? `你请求了学习账号帮助。\n\n请打开登录入口继续，或使用注册入口开始创建学习账号。\n\n登录：${config.origin}/login\n注册：${config.origin}/register\n\n若不是你发起的请求，请忽略这封邮件。\n\n物理化学 · 学习空间`
      : `You requested help with a study account.\n\nOpen the sign-in page to continue, or the registration page to start creating a study account.\n\nSign in: ${config.origin}/login\nRegister: ${config.origin}/register\n\nIf you did not request this, ignore this email.\n\nPhysical Chemistry · Study Space`
    : zh
      ? `${subject}\n\n${verify ? "打开链接，并再次输入你注册时选择的密码来完成验证。" : "打开链接，亲自设置一个新密码。完成后，你所有设备上的登录会话都会退出。"}\n\n${link}\n\n链接将在${verify ? "24 小时" : "30 分钟"}后失效，只可使用一次。若不是你发起的请求，请忽略这封邮件。\n\n物理化学 · 学习空间`
      : `${subject}\n\n${verify ? "Open this link and re-enter the password you chose during registration." : "Open this link to choose a new password yourself. Completing this will sign out every device."}\n\n${link}\n\nThis link expires in ${verify ? "24 hours" : "30 minutes"} and can be used once. If you did not request this, ignore this email.\n\nPhysical Chemistry · Study Space`;
  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: config.from, to: [mail.to], subject, text }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Delivery failed");
    const result: unknown = await response.json();
    if (
      !result ||
      typeof result !== "object" ||
      !("id" in result) ||
      typeof result.id !== "string"
    )
      throw new Error("Delivery failed");
  } catch {
    throw new AccountError("MAIL_UNAVAILABLE", 503);
  }
}
