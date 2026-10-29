import { getSessionState } from "@/lib/auth";
import { searchStudyLibrary } from "@/lib/search-service";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const query = (params.get("q") || "").slice(0, 200).trim();
    const locale = params.get("locale") === "en" ? "en" : "zh";
    const subject = (params.get("subject") || "").slice(0, 100);
    const session = await getSessionState();
    if (session.status === "unavailable") throw new Error("Search unavailable");
    const result = await searchStudyLibrary(
      query,
      locale,
      session.status === "authenticated" ? session.user.id : undefined,
      subject,
    );
    return Response.json(
      { ok: true, data: result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false, code: "UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
