import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import {
  getAuthAvailability,
  getAuthOptions,
  getAuthSecret,
  logAuthFailure,
  trackAuthOperation,
} from "@/lib/auth";
import { hasSessionCookie } from "@/lib/auth-config";
import {
  applySessionCookiePolicy,
  googleOAuthState,
  loginPreferenceCookieName,
  readLoginPreference,
  readRequestedRemember,
  signLoginPreference,
  withLoginPreferenceCookie,
  type ObservedSession,
} from "@/lib/session-policy";

type AuthRouteContext = { params: Promise<{ nextauth: string[] }> };

function unavailable(status: "unconfigured" | "unavailable"): Response {
  return Response.json(
    {
      error:
        status === "unconfigured" ? "AUTH_NOT_CONFIGURED" : "AUTH_UNAVAILABLE",
      message:
        status === "unconfigured"
          ? "Sign-in has not been configured yet."
          : "Sign-in is temporarily unavailable. Please try again later.",
      url: `/login?error=${status === "unconfigured" ? "configuration" : "unavailable"}`,
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

async function handleAuth(
  req: NextRequest,
  context: AuthRouteContext,
): Promise<Response> {
  const params = await context.params;
  const isCallback = params.nextauth[0] === "callback";
  const isSignIn =
    req.method === "POST" &&
    params.nextauth[0] === "signin" &&
    params.nextauth[1] === "google";
  const secureCookies =
    new URL(process.env.NEXTAUTH_URL || req.url).protocol === "https:";
  const clearPreference = (response: Response) =>
    withLoginPreferenceCookie(response, "", secureCookies);
  const configured = getAuthAvailability().status === "ready";
  if (!configured) {
    // SessionProvider can mount on public pages before authentication is set up.
    const cookieHeader = req.headers.get("cookie") ?? "";
    const cookiePairs = cookieHeader.split(";").map((part) => {
      const index = part.indexOf("=");
      return {
        name: part.slice(0, index).trim(),
        value: index < 0 ? "" : part.slice(index + 1),
      };
    });
    if (
      req.method === "GET" &&
      params.nextauth[0] === "session" &&
      !hasSessionCookie(cookiePairs)
    ) {
      return Response.json({}, { headers: { "Cache-Control": "no-store" } });
    }
    const response = unavailable("unconfigured");
    return isCallback ? clearPreference(response) : response;
  }
  try {
    const requestedRemember = isSignIn
      ? await readRequestedRemember(req)
      : false;
    const remember =
      isCallback &&
      readLoginPreference(
        req.cookies.get(loginPreferenceCookieName(secureCookies))?.value,
        req.nextUrl.searchParams.get("state") ?? "",
        getAuthSecret(),
      );
    let observedSession: ObservedSession | undefined;
    const { result: response, failed } = await trackAuthOperation<Response>(
      () =>
        NextAuth(
          getAuthOptions({
            remember,
            userAgent: req.headers.get("user-agent") || undefined,
            observe(session) {
              observedSession = session;
            },
          }),
        )(req, { params }),
    );
    if (failed && req.method === "GET" && isCallback) {
      return clearPreference(
        Response.redirect(new URL("/login?error=unavailable", req.url), 303),
      );
    }
    if (failed) return unavailable("unavailable");
    let result = applySessionCookiePolicy(response, observedSession);
    if (isCallback || params.nextauth[0] === "signout")
      result = clearPreference(result);
    if (isSignIn) {
      const state = await googleOAuthState(result);
      result = withLoginPreferenceCookie(
        result,
        state
          ? signLoginPreference(requestedRemember, state, getAuthSecret())
          : "",
        secureCookies,
      );
    }
    return result;
  } catch (error) {
    logAuthFailure("AUTH_ROUTE", error);
    const response = unavailable("unavailable");
    return isCallback ? clearPreference(response) : response;
  }
}

export function GET(
  req: NextRequest,
  context: AuthRouteContext,
): Promise<Response> {
  return handleAuth(req, context);
}

export function POST(
  req: NextRequest,
  context: AuthRouteContext,
): Promise<Response> {
  return handleAuth(req, context);
}
