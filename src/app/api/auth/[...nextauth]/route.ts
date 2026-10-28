import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import {
  getAuthAvailability,
  getAuthOptions,
  logAuthFailure,
  trackAuthOperation,
} from "@/lib/auth";
import { hasSessionCookie } from "@/lib/auth-config";

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
    return unavailable("unconfigured");
  }
  try {
    const { result: response, failed } = await trackAuthOperation<Response>(
      () => NextAuth(getAuthOptions())(req, { params }),
    );
    if (failed && req.method === "GET" && params.nextauth[0] === "callback") {
      return Response.redirect(
        new URL("/login?error=unavailable", req.url),
        303,
      );
    }
    return failed ? unavailable("unavailable") : response;
  } catch (error) {
    logAuthFailure("AUTH_ROUTE", error);
    return unavailable("unavailable");
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
