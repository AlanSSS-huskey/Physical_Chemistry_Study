import type { Prisma } from "@prisma/client";
import { AccountError } from "./account-security.ts";

export function privateNoteFilter(
  userId: string,
  input: string | null,
): Prisma.PersonalNoteWhereInput {
  if (input && (input.length > 200 || /[\u0000-\u001f\u007f]/u.test(input)))
    throw new AccountError("VALIDATION_ERROR", 400);
  const query = input?.trim();
  return {
    userId,
    body: {
      not: "",
      ...(query
        ? {
            // Postgres contains uses LIKE; search punctuation literally.
            contains: query.replace(/[\\%_]/g, "\\$&"),
            mode: "insensitive" as const,
          }
        : {}),
    },
  };
}
