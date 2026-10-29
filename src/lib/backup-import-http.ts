import { AccountError, assertAccountMutation } from "./account-security.ts";

export const MAX_IMPORT_REQUEST_BYTES = 2 * 1024 * 1024;
/** Import files exceed ordinary form sizes; keep this larger parser local to
 * the signed import API rather than widening every account mutation. */
export async function readBackupImportMutation(
  request: Request,
): Promise<Record<string, unknown>> {
  assertAccountMutation(request);
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new AccountError("BACKUP_INVALID", 400);
  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_IMPORT_REQUEST_BYTES
  )
    throw new AccountError("BACKUP_TOO_LARGE", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AccountError("BACKUP_INVALID", 400);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let body = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMPORT_REQUEST_BYTES) {
        await reader.cancel();
        throw new AccountError("BACKUP_TOO_LARGE", 413);
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    const input: unknown = JSON.parse(body);
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new AccountError("BACKUP_INVALID", 400);
    return input as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AccountError) throw error;
    throw new AccountError("BACKUP_INVALID", 400);
  } finally {
    reader.releaseLock();
  }
}
