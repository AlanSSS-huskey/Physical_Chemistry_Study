import {
  accountDataService,
  accountDataSession,
  accountDataResponse,
} from "@/lib/account-data-http";
import { accountFailure, getAccountMutation } from "@/lib/account-security";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    await getAccountMutation(request);
    const session = await accountDataSession(request);
    return accountDataResponse(
      await accountDataService().retryStorageCleanup(session.userId),
    );
  } catch (error) {
    return accountFailure(error);
  }
}
