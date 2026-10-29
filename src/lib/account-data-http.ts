import { prisma } from "@/lib/db";
import { deleteImageObject } from "@/lib/storage";
import {
  createAccountDataService,
  requireAccountDataIdentity,
} from "./account-data.ts";
import {
  clearAccountSessionCookie,
  clearAccountSessionChunks,
  getCurrentAccountSession,
} from "./account-sessions.ts";

export function accountDataService() {
  return createAccountDataService({
    db: prisma,
    deleteObject: deleteImageObject,
  });
}
export async function accountDataSession(request: Request) {
  const session = await getCurrentAccountSession(request);
  return requireAccountDataIdentity(request, session);
}
export function accountDataResponse(data: unknown) {
  return Response.json(
    { ok: true, data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export function signOutChangedAccount(
  response: Response,
  request: Request,
  userId: string,
  callerUserId?: string,
) {
  if (!callerUserId || callerUserId === userId) {
    response.headers.append("Set-Cookie", clearAccountSessionCookie(request));
    clearAccountSessionChunks(response, request);
  }
  return response;
}
