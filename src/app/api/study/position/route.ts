import {
  readChapterState,
  writeChapterState,
  studyIdentity,
  studyUser,
  studyResponse,
  studyFailure,
} from "@/lib/study-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const userId = await studyUser(request);
    const identity = await studyIdentity(request, userId);
    return studyResponse(
      await readChapterState("position", userId, identity),
      userId,
    );
  } catch (error) {
    return studyFailure(error);
  }
}
export async function PUT(request: Request) {
  try {
    return await writeChapterState("position", request);
  } catch (error) {
    return studyFailure(error);
  }
}
