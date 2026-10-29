export class AccountRequestError extends Error {
  code: string;
  retryAfter?: number;

  constructor(code: string, retryAfter?: number) {
    super(code);
    this.name = "AccountRequestError";
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export function passwordProblem(password: string, confirmation: string) {
  const length = [...password].length;
  if (length < 12 || length > 128) return "PASSWORD_LENGTH";
  if (password !== confirmation) return "PASSWORD_CONFIRMATION";
  return null;
}

export function tokenFromFragment(fragment: string): string | null {
  const token = new URLSearchParams(fragment.replace(/^#/, "")).get("token");
  return token && token.length <= 4096 ? token : null;
}

export async function accountRequest<T = { ok: true }>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: Record<string, unknown> | FormData;
    signal?: AbortSignal;
    fetcher?: typeof fetch;
    accountUserId?: string;
  } = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    signal,
    fetcher = fetch,
    accountUserId,
  } = options;
  try {
    const headers = new Headers();
    if (accountUserId) headers.set("X-Account-User", accountUserId);
    if (method !== "GET") {
      const csrfResponse = await fetcher("/api/account/csrf", {
        credentials: "same-origin",
        cache: "no-store",
        signal,
      });
      const csrf = await csrfResponse.json();
      if (!csrfResponse.ok || typeof csrf.csrfToken !== "string")
        throw new AccountRequestError("UNAVAILABLE");
      headers.set("X-CSRF-Token", csrf.csrfToken);
    }
    const multipart = body instanceof FormData;
    if (body && !multipart) headers.set("Content-Type", "application/json");
    const response = await fetcher(path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers,
      signal,
      ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok || result?.ok !== true)
      throw new AccountRequestError(
        typeof result?.code === "string" ? result.code : "UNAVAILABLE",
        typeof result?.retryAfter === "number" ? result.retryAfter : undefined,
      );
    return result as T;
  } catch (error) {
    if (error instanceof AccountRequestError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new AccountRequestError("UNAVAILABLE");
  }
}

const messages: Record<string, [string, string]> = {
  INVALID_CREDENTIALS: [
    "邮箱或密码不正确，请重试。",
    "The email or password is incorrect. Please try again.",
  ],
  PASSWORD_MISMATCH: [
    "密码不正确，请输入注册时设置的密码。",
    "That password does not match. Enter the password you chose when registering.",
  ],
  CURRENT_PASSWORD_INVALID: [
    "当前密码不正确，请重试。",
    "Your current password is incorrect. Please try again.",
  ],
  PASSWORD_NOT_SET: [
    "此账户尚未设置密码，请通过邮箱链接设置。",
    "This account does not have a password yet. Set one using an email link.",
  ],
  USE_PASSWORD_RESET: [
    "请通过“忘记密码”申请邮件，由邮箱持有人重新设置密码。",
    "Use “Forgot password” to request an email and explicitly choose a password as the email owner.",
  ],
  PASSWORD_LENGTH: [
    "密码需为 12 至 128 个字符，可使用中文、空格或短语。",
    "Use 12–128 characters. Spaces, phrases and non-Latin characters are welcome.",
  ],
  PASSWORD_CONFIRMATION: [
    "两次输入的密码不一致。",
    "The passwords do not match.",
  ],
  TOKEN_INVALID: [
    "此链接无效或已使用，请申请新的邮件链接。",
    "This link is invalid or has already been used. Request a new email link.",
  ],
  TOKEN_EXPIRED: [
    "此链接已过期，请申请新的邮件链接。",
    "This link has expired. Request a new email link.",
  ],
  MAIL_UNAVAILABLE: [
    "邮件发送暂时未能确认，请稍后重试。若收到旧链接，请以最新申请为准。",
    "Email delivery could not be confirmed. Please try again shortly and use the newest requested link.",
  ],
  MAIL_PARTIAL: [
    "部分确认邮件可能已经送达，但本次链接已失效。请重新申请，并使用最新两封邮件。",
    "One confirmation email may have arrived, but this request has been cancelled. Request again and use the newest two emails.",
  ],
  EMAIL_UNAVAILABLE: [
    "该邮箱暂时不能用于此账户，请更换邮箱后重试。",
    "This email cannot be used for this account. Choose another address.",
  ],
  EMAIL_UNCHANGED: [
    "请输入与当前账户不同的新邮箱。",
    "Enter an email different from your current account email.",
  ],
  EMAIL_REQUIRED: [
    "此账户没有可确认的邮箱，请先联系网站负责人。",
    "This account has no email to confirm. Contact the site owner first.",
  ],
  REQUEST_REPLACED: [
    "此申请已被后续操作替代，请从账户设置重新发起。",
    "A later action replaced this request. Start again from account settings.",
  ],
  REAUTH_REQUIRED: [
    "账户安全设置已变化，请重新登录并再次确认。",
    "Account security settings changed. Sign in again and confirm the action.",
  ],
  SESSION_CHANGED: [
    "登录账户已变化。请重新打开账户设置，核对当前账户后再操作。",
    "Your signed-in account changed. Reopen account settings and review the current account before continuing.",
  ],
  CONFIRMATION_REQUIRED: [
    "请阅读操作说明并明确确认后继续。",
    "Review the action and explicitly confirm before continuing.",
  ],
  LAST_ADMIN: [
    "最后一位管理员不能注销。请先安排另一位管理员管理网站。",
    "The last administrator cannot delete their account. Arrange another site administrator first.",
  ],
  VALIDATION_ERROR: [
    "请检查填写内容后重试。",
    "Please check the information you entered and try again.",
  ],
  RATE_LIMITED: [
    "请求过于频繁，请稍等片刻再试。",
    "Too many requests. Please wait a moment before trying again.",
  ],
  UNAUTHENTICATED: [
    "登录状态已失效，请重新登录。",
    "Your session has expired. Please sign in again.",
  ],
  FORBIDDEN: [
    "此操作暂时无法完成，请刷新页面后重试。",
    "This action could not be completed. Refresh the page and try again.",
  ],
  CSRF_INVALID: [
    "此页面的安全验证已过期，请刷新后重试。",
    "The page’s security check expired. Refresh the page and try again.",
  ],
  INVALID_FILE_TYPE: [
    "请选择 PNG、JPEG 或 WebP 图片。",
    "Choose a PNG, JPEG or WebP image.",
  ],
  FILE_TOO_LARGE: [
    "图片大小不能超过 4 MB。",
    "Choose an image smaller than 4 MB.",
  ],
  UNAVAILABLE: [
    "账户服务暂时不可用，请稍后重试。你的操作尚未完成。",
    "The account service is temporarily unavailable. Your action has not been completed. Please try again shortly.",
  ],
};

export function accountErrorMessage(error: unknown, locale: "zh" | "en") {
  const code =
    error instanceof AccountRequestError ? error.code : "UNAVAILABLE";
  return (messages[code] ?? messages.UNAVAILABLE)[locale === "zh" ? 0 : 1];
}
