# 学习空间功能验收 / Study workspace verification

后续状态：所有者已明确授权，本轮迁移和正式发布已完成。以下保留发布前的验收记录；当前结果见[正式发布记录](2026-10-29-production-release.md)。

Date: 2026-10-29. Branch: `codex/study-workspace`, based on the existing
`codex/account-auth` implementation. This report describes tested source, not a
claim that the changes are already on the public production site.

## Delivered

- Reading preferences and language-specific position sync, explicit resume,
  truthful pending/saved/error states and optimistic conflict resolution.
- Shared bookmarks, language-specific private notes and paginated personal
  library. Existing own text remains available after chapter revocation/trash.
- Chinese/English public-catalog full-text search, authorized preview trimming,
  stable rendered heading targets, snippets and subject filtering.
- Private admin automatic drafts, immutable content versions, transactional
  conflict checks, unpublished recovery and reversible trash.
- Allowlisted personal JSON export, independent old/new mailbox proofs, explicit
  account deletion, last-admin protection and durable avatar cleanup retries.
- Identity headers prevent old study/admin/account-data panels from writing to
  a newly signed-in account. Unsaved writing can veto links, language changes,
  sign-out and closing. Password changes invalidate pending identity proofs.
- Public illustrations referenced in content, translations, private drafts or
  immutable history survive uploader deletion. Publication locks referenced image
  rows and rejects missing/queued images; serializable mutations coordinate with
  account deletion. Reference checks run in the database and return IDs only.
- Unregistered dynamic Vercel previews disable Google start/callback while
  preserving password login and providing the stable production sign-in link.

## Automated checks

Final source: `npm test` **205/205 passed**, ESLint and TypeScript passed,
`npm run build` passed, Prettier check passed, `git diff --check` passed.
Production-dependency audit: zero reported vulnerabilities. Dependencies were
not added for this round.

Targeted regressions were observed failing before their fixes, including generated
image/footnote heading anchors, switched-account actions, serializable conflict
responses, proof activation, shared-image preservation and unbounded image
reference reads.

## Actual database and HTTP checks

All synthetic writes used a unique owned schema in the verified Supabase project,
database `postgres`. No production user was used as a fixture. All test addresses
used `@example.invalid`. A private Node preload captured fake-key provider requests
and blocked external HTTP; it is outside the repository and does not ship.

| Suite                                                                     | Result                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Reading / notes / bookmarks / search                                      | 5 groups, 65 assertions passed                                            |
| Admin drafts / versions / trash / large content                           | 9 groups, 79 assertions passed                                            |
| Account export / owner binding / identity proofs / deletion / image races | 8 groups, 78 assertions passed                                            |
| Concurrent last-admin deletion                                            | 6 assertions; one deletion, one `LAST_ADMIN` refusal                      |
| Final concurrent article saves                                            | 8 checks; one success, one `VERSION_CONFLICT`, immutable history retained |
| Preview Google guard                                                      | 4 checks; no real OAuth requests                                          |

All six repository migrations applied successfully to the empty owned schema.
All 28 internal tables had RLS. All nine new private tables had direct PUBLIC,
anon and authenticated privileges revoked, including TRUNCATE. All foreign keys
stayed within the owned schema. The sixth migration has not been applied to the
production application schema in this round.

Large-input checks included a valid 2.7 MB bilingual request and a request above
the 6 MB limit. Large fixtures remained present during final account deletion and
concurrent image-publication checks. Early account probes encountered service
failures; after replacing full payload reads with database-side existence checks,
the final complete account suite passed.

Protected schema definitions, planner functions and privileges, and the separate
development database fingerprints matched their baselines. Production counts
remained one user, one Google account and one session. A concurrent change to the
other application's planner state was observed and left untouched.

Cleanup completed after verification: the exact owned schema containing 25
synthetic users was removed after dependency checks; 22 captured fixture messages
and temporary test credentials were deleted. Only owned test servers were stopped.
Sanitized reports were preserved locally. No real emails were sent.

## Browser verification

The real in-app browser checked Chinese/English account and personal-library UI,
password sign-in, bookmark persistence, private-note save and reload, simulated
second-device conflict, explicit keep-local resolution, private automatic draft
recovery after reopening, and immutable history controls. The account settings
panel loaded through the final identity-bound endpoints. Reader/library screenshot
inspection passed; the reader agent reported an empty console-error log for its
flows. This round did not add a new mobile viewport certification.

## Release and external setup

Real transactional email delivery has not been verified. The owner still needs an
owned sending domain and Resend configuration; registration and mail-dependent
actions report unavailable when these are missing. Provider acceptance is not a
claim of inbox delivery. See [email setup](../setup/transactional-email.md).

Google Cloud must explicitly register a stable preview callback before
`GOOGLE_PREVIEW_ORIGIN` is enabled. Disabling an unregistered preview flow does not
claim to modify Google Cloud or repair embedded-browser passkey support.

The public production site is not replaced by this round. Earlier automatic
approval rejection for production publishing and anonymous preview sharing remains
in force. Do not bypass it. Apply the sixth migration to the verified application
target and publish only after the required release authorization. See
[feature behavior](../setup/study-workspace.md) and
[admin recovery](../setup/admin-recovery.md).
