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
type Context = { params: Promise<{ phase: string }> };
export async function POST(request: Request, context: Context) {
  try {
    const { phase } = await context.params;
    if (phase !== "status" && phase !== "confirm")
      throw new AccountError("NOT_FOUND", 404);
    const input = await getAccountMutation(request);
    const service = accountDataService();
    if (phase === "status")
      return accountDataResponse(
        await service.emailChangeStatus(input, request),
      );
    const caller = await getCurrentAccountSession(request);
    const result = await service.confirmEmailChange(input, request);
    const response = accountDataResponse({ completed: result.completed });
    return result.completed && result.userId
      ? signOutChangedAccount(response, request, result.userId, caller?.userId)
      : response;
  } catch (error) {
    return accountFailure(error);
  }
}
