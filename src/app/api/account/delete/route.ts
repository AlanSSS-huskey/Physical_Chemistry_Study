import {
  accountDataService,
  accountDataSession,
  accountDataResponse,
  signOutChangedAccount,
} from "@/lib/account-data-http";
import { accountFailure, getAccountMutation } from "@/lib/account-security";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const input = await getAccountMutation(request);
    const session = await accountDataSession(request);
    const result = await accountDataService().requestDeletion(
      session.userId,
      input,
      request,
    );
    const response = accountDataResponse(result);
    return result.deleted
      ? signOutChangedAccount(response, request, session.userId, session.userId)
      : response;
  } catch (error) {
    return accountFailure(error);
  }
}
