# Account authentication

## Scope and acceptance

Add bilingual registration, email/password login, explicit email verification,
password recovery, profile/avatar editing, password change and session revocation.
Keep existing Google identities, learning records and database sessions. A shared
Remember me choice gives an absolute 30-day persistent session or a 12-hour
browser session; reading a session never extends that expiry.

Acceptance requires real HTTP tests against an isolated migrated database, UI
checks in Chinese and English at narrow and desktop widths, and truthful service
readiness. Email delivery must not report success when its provider is absent.
Real delivery requires the owner's verified sender domain and restricted provider
key; see [transactional email setup](setup/transactional-email.md).

## Implementation order

1. Add password/token/rate-limit persistence with an additive migration.
2. Implement bounded requests, CSRF, scrypt credentials, one-use email tokens and
   Resend transport; prove security boundaries before exposing UI.
3. Add shared bilingual forms and account settings backed by the real endpoints.
4. Verify complete flows in a fresh `chemistry_auth_test_*` schema, review the
   integrated change, and run lint, types, unit tests and production build.
5. Configure verified email delivery and deploy only with known production
   configuration and a reviewed additive migration.

## Decisions and threat boundaries

NextAuth's database sessions remain the single identity/session authority.
NextAuth v4 Credentials requires JWT sessions, so the password endpoints issue
the existing opaque database session format instead of mixing session strategies.
Google sign-in retains its standard provider implementation.

Pending registrations do not create users. An email verification link requires
the registration password again, preventing activation of an attacker's password
by a mailbox owner. Existing Google users can set a password only through a
separate mailbox-ownership flow. Password reset revokes all sessions and requires
a fresh login. Password change requires the current password and revokes others.

Tokens contain 256 random bits; only hashes are stored. Links carry tokens in
fragments, and GET requests never consume them. Explicit same-origin POSTs use a
signed HttpOnly CSRF cookie plus a header nonce. Email URLs derive from configured
`NEXTAUTH_URL`; request Host never chooses a recovery destination. Errors expose
stable codes, never database/provider internals. Rate limits store HMAC-derived
identifiers. Public profile/session DTOs exclude tokens, password hashes and raw
user agents. Every session deletion includes the authenticated user id.

Avatar uploads reuse signature-checked PNG/JPEG/WebP storage with a 4 MiB limit,
bounded multipart parsing and compensation if database persistence fails. Per-user
database counters allow five uploads per hour and ten per day. Session activity
updates at most once per minute during ordinary session reads; it does not extend
expiry. Email lookup uses case-insensitive exact membership, avoiding SQL pattern
matching for literal `_` and `%` characters.

## API

All responses use `Cache-Control: no-store`. Mutations require same-origin
`Origin`, `X-CSRF-Token`, and JSON except the multipart avatar route.
Success responses use `{ok:true,data?}`; failures use
`{ok:false,code,retryAfter?,fields?}` and appropriate HTTP status.

| Endpoint                                | Behavior                                                |
| --------------------------------------- | ------------------------------------------------------- |
| GET `/api/account/csrf`                 | Signed-cookie CSRF nonce; reuses a valid existing nonce |
| GET `/api/account/capabilities`         | Actual Google/password/registration/mail readiness      |
| POST `/api/account/register`            | Pending registration and verification email             |
| POST `/api/account/resend-verification` | Generic accepted email response                         |
| POST `/api/account/verify`              | Token plus original password; activates then signs in   |
| POST `/api/account/login`               | Email/password database session                         |
| POST `/api/account/forgot-password`     | Generic accepted reset/set-password email               |
| POST `/api/account/token-status`        | Non-consuming token status                              |
| POST `/api/account/reset-password`      | One-use token; replace password, revoke sessions        |
| POST `/api/account/change-password`     | Current-password check; revoke other sessions           |
| GET/PATCH `/api/account/profile`        | Public profile / name update only                       |
| POST `/api/account/avatar`              | Authenticated image upload                              |
| GET/DELETE `/api/account/sessions`      | Active sessions / revoke others                         |
| DELETE `/api/account/sessions/[id]`     | Revoke an owned session                                 |

## Verification record (2026-10-29)

- 138 native Node tests, ESLint, TypeScript, formatting and a production Next.js
  build passed. Two independent code reviews found and verified fixes for
  registration timing/version binding, literal email matching and session activity.
- An isolated PostgreSQL schema passed all five migrations, with RLS on all 19
  tables. Real HTTP testing passed 22 groups / 297 assertions, including NextAuth
  compatibility, concurrent token use, exact `_`/`%` identities, expiry, recovery,
  profile ownership and session revocation. All 25 provider requests were captured
  by a test-only process outside the application; no real email was sent.
- Browser checks covered both languages, registration validation, explicit email
  confirmation, short-session login, profile persistence and logout. Desktop
  layout was visually inspected; the authenticated header remained 89 px high.
- No external Resend delivery has been verified. A verified sender domain and
  restricted server-side key are still required before public email registration
  and recovery can be enabled. Tests with intercepted mail do not prove delivery.

## Primary references

- [NextAuth Credentials restrictions](https://next-auth.js.org/providers/credentials)
- [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP password recovery](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [Resend email API](https://resend.com/docs/api-reference/emails/send-email)
