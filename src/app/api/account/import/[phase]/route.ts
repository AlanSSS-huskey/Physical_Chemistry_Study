import { prisma } from "@/lib/db";
import {
  accountDataResponse,
  accountDataSession,
} from "@/lib/account-data-http";
import { AccountError, accountFailure } from "@/lib/account-security";
import { createBackupImportService } from "@/lib/backup-import";
import { readBackupImportMutation } from "@/lib/backup-import-http";

export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ phase: string }> };
export async function POST(request: Request, context: Context) {
  try {
    const { phase } = await context.params;
    if (phase !== "preview" && phase !== "apply")
      throw new AccountError("NOT_FOUND", 404);
    const session = await accountDataSession(request);
    const input = await readBackupImportMutation(request);
    const allowed =
      phase === "preview"
        ? ["backup"]
        : ["backup", "previewToken", "conflictMode", "confirm"];
    if (Object.keys(input).some((key) => !allowed.includes(key)))
      throw new AccountError("BACKUP_INVALID", 400);
    const service = createBackupImportService({ db: prisma });
    return accountDataResponse(await service[phase](session.userId, input));
  } catch (error) {
    return accountFailure(error);
  }
}
