import test from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
  createEmailToken,
  hashEmailToken,
  maskAccountEmail,
} from "../src/lib/passwords.ts";
test("passwords use salted OWASP scrypt and reject wrong or malformed hashes", async () => {
  const first = await hashPassword("a sufficiently long password");
  const second = await hashPassword("a sufficiently long password");
  assert.notEqual(first, second);
  assert.match(first, /^scrypt\$131072\$8\$1\$/);
  assert.equal(
    await verifyPassword("a sufficiently long password", first),
    true,
  );
  assert.equal(await verifyPassword("a different long password", first), false);
  assert.equal(
    await verifyPassword(
      "a sufficiently long password",
      "scrypt$999999999$8$1$bad$bad",
    ),
    false,
  );
});
test("email tokens have 256 bits of randomness and only hashes belong in storage", () => {
  const token = createEmailToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(createEmailToken(), token);
  assert.match(hashEmailToken(token), /^[a-f0-9]{64}$/);
  assert.equal(maskAccountEmail("person@example.com"), "p***@example.com");
});
