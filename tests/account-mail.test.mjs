import test from "node:test";
import assert from "node:assert/strict";
import { sendAccountMail, accountMailReady } from "../src/lib/account-mail.ts";
test("email requires real provider configuration and never pretends to send", async () => {
  assert.equal(accountMailReady({}), false);
  await assert.rejects(
    () =>
      sendAccountMail(
        {
          to: "person@example.com",
          purpose: "VERIFY_EMAIL",
          token: "private-token",
          locale: "en",
        },
        {},
        async () => assert.fail("must not call provider"),
      ),
    { code: "MAIL_UNAVAILABLE" },
  );
});
test("mail uses the configured HTTPS origin and fragment links without exposing provider errors", async () => {
  let sent;
  const env = {
    RESEND_API_KEY: "test-only-key",
    EMAIL_FROM: "Study <account@example.com>",
    NEXTAUTH_URL: "https://study.example",
  };
  await sendAccountMail(
    {
      to: "person@example.com",
      purpose: "VERIFY_EMAIL",
      token: "test_token",
      locale: "en",
    },
    env,
    async (url, init) => {
      sent = { url, init };
      return Response.json({ id: "delivery-accepted" });
    },
  );
  assert.equal(sent.url, "https://api.resend.com/emails");
  assert.match(
    JSON.parse(sent.init.body).text,
    /https:\/\/study\.example\/verify-email#token=test_token/,
  );
  assert.doesNotMatch(JSON.parse(sent.init.body).text, /\?token=/);
  await assert.rejects(
    () =>
      sendAccountMail(
        {
          to: "person@example.com",
          purpose: "RESET_PASSWORD",
          token: "private-token",
          locale: "zh",
        },
        env,
        async () => new Response("provider-secret", { status: 500 }),
      ),
    (error) =>
      error.code === "MAIL_UNAVAILABLE" &&
      !error.message.includes("provider-secret"),
  );
});
test("neutral account help contains only public entry links and no action token", async () => {
  let sent;
  await sendAccountMail(
    { to: "person@example.com", purpose: "ACCOUNT_HELP", locale: "en" },
    {
      RESEND_API_KEY: "test-only-key",
      EMAIL_FROM: "Study <account@example.com>",
      NEXTAUTH_URL: "https://study.example",
    },
    async (_url, init) => {
      sent = JSON.parse(init.body);
      return Response.json({ id: "accepted-help" });
    },
  );
  assert.match(sent.text, /https:\/\/study\.example\/login/);
  assert.match(sent.text, /https:\/\/study\.example\/register/);
  assert.doesNotMatch(
    sent.text,
    /#token=|account does not exist|not registered/i,
  );
});
