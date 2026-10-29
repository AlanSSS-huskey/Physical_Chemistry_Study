import {
  accountDataService,
  accountDataSession,
} from "@/lib/account-data-http";
import { accountFailure } from "@/lib/account-security";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const session = await accountDataSession(request);
    const document = await accountDataService().export(session.userId);
    return new Response(JSON.stringify(document, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="physical-chemistry-account-${new Date().toISOString().slice(0, 10)}.json"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return accountFailure(error);
  }
}
