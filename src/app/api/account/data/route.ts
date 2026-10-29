import {
  accountDataService,
  accountDataSession,
  accountDataResponse,
} from "@/lib/account-data-http";
import { accountFailure } from "@/lib/account-security";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const session = await accountDataSession(request);
    return accountDataResponse(
      await accountDataService().summary(session.userId),
    );
  } catch (error) {
    return accountFailure(error);
  }
}
