import { getAccountMutation } from "@/lib/account-security";
import {
  readPreferences,
  writePreferences,
  studyUser,
  studyResponse,
  studyFailure,
} from "@/lib/study-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const userId = await studyUser(request);
    return studyResponse(await readPreferences(userId), userId);
  } catch (error) {
    return studyFailure(error);
  }
}
export async function PUT(request: Request) {
  try {
    const body = await getAccountMutation(request);
    const userId = await studyUser(request);
    return studyResponse(await writePreferences(userId, body), userId);
  } catch (error) {
    return studyFailure(error);
  }
}
