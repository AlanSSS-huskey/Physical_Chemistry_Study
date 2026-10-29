import {
  accountDataService,
  accountDataResponse,
  signOutChangedAccount,
} from "@/lib/account-data-http";
import {
  AccountError,
  accountFailure,
  getAccountMutation,
} from "@/lib/account-security";
import { getCurrentAccountSession } from "@/lib/account-sessions";
export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ phase: string }> };
export async function POST(request: Request, context: Context) {
  try {
    const { phase } = await context.params;
    if (phase !== "status" && phase !== "confirm")
      throw new AccountError("NOT_FOUND", 404);
    const input = await getAccountMutation(request);
    const service = accountDataService();
    if (phase === "status")
      return accountDataResponse(await service.deletionStatus(input, request));
    const caller = await getCurrentAccountSession(request);
    const result = await service.confirmDeletion(input, request);
    return signOutChangedAccount(
      accountDataResponse({
        deleted: result.deleted,
        cleanupPending: result.cleanupPending,
      }),
      request,
      result.userId,
      caller?.userId,
    );
  } catch (error) {
    return accountFailure(error);
  }
}
