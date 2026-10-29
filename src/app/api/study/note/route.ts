import {
  readChapterState,
  writeChapterState,
  studyUser,
  studyResponse,
  studyFailure,
} from "@/lib/study-server";
import { validateStudyIdentity } from "@/lib/study-state";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const userId = await studyUser(request);
    const params = new URL(request.url).searchParams;
    const identity = validateStudyIdentity({
      slug: params.get("slug"),
      locale: params.get("locale"),
    });
    return studyResponse(
      await readChapterState("note", userId, identity),
      userId,
    );
  } catch (error) {
    return studyFailure(error);
  }
}
export async function PUT(request: Request) {
  try {
    return await writeChapterState("note", request);
  } catch (error) {
    return studyFailure(error);
  }
}
