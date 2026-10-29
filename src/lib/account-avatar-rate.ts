import { createHmac } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { AccountError } from "./account-security.ts";

/** Shared database counters keep the storage budget effective across instances. */
export async function limitAccountAvatar(
  store: Pick<Prisma.TransactionClient["authRateLimit"], "upsert">,
  userId: string,
  secret: string,
  now = Date.now(),
) {
  for (const [seconds, maximum] of [
    [3600, 5],
    [86400, 10],
  ]) {
    const bucket = Math.floor(now / (seconds * 1000));
    const key = createHmac("sha256", secret)
      .update(`account-avatar:${userId}:${seconds}:${bucket}`)
      .digest("hex");
    const expiresAt = new Date((bucket + 1) * seconds * 1000);
    const row = await store.upsert({
      where: { key },
      create: { key, count: 1, expiresAt },
      update: { count: { increment: 1 } },
    });
    if (row.count > maximum)
      throw new AccountError(
        "RATE_LIMITED",
        429,
        Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)),
      );
  }
}
