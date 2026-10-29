import {
  accountDataService,
  accountDataSession,
  accountDataResponse,
} from "@/lib/account-data-http";
import { accountFailure, getAccountMutation } from "@/lib/account-security";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const input = await getAccountMutation(request);
    const session = await accountDataSession(request);
    return accountDataResponse(
      await accountDataService().requestEmailChange(
        session.userId,
        input,
        request,
      ),
    );
  } catch (error) {
    return accountFailure(error);
  }
}
