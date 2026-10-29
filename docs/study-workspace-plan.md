# Study workspace implementation

User-approved scope: bilingual automatic reading-state/preferences sync, bookmarks
and private chapter notes, bilingual full-text search, admin automatic drafts /
version recovery / trash, and account export / safe email change / deletion.

Release update (2026-10-29): the owner explicitly authorized production publication.
The sixth migration and production deployment completed, preserving existing
identities and sessions. Earlier release restrictions below describe planning-time
state; see the production-release record for the completed authorization and checks.

## Boundaries

- Reuse the existing NextAuth database sessions and signed account CSRF helper.
- The root owns Prisma schema/migration, content loading/search, integration and
  release checks. Agents own disjoint vertical feature slices.
- Mutations require authentication, ownership/admin checks, bounded input and
  optimistic revisions where edits can conflict. Retries must never silently
  overwrite another user's or another device's edits. No false save acknowledgments.
- Private notes are plain text and account-scoped. Reading positions are separate
  for each content language; switching language never invents an equivalent anchor.
- Search may index only bodies the caller can read. Draft/private/deleted bodies
  and gated tails cannot appear in snippets. Search links use real rendered ids.
- Soft-deleted database overrides must still hide their bundled sample identities.
- Restoring content creates a new version. History is immutable; trash is reversible.
- Account export excludes password hashes, OAuth credentials, session secrets and
  other users' records. Email changes require ownership of old and new mailboxes.
  Account deletion requires explicit end-user confirmation and recent proof.
- Preserve public content images when deleting an uploader; remove private avatar
  records and queue failed object cleanup durably. Never run real deletion tests
  against the owner's production identity.
- Existing production publishing and anonymous preview sharing remain subject to
  the previous approval rejection. Do not retry through another tool or route.

## Delivery slices and checks

1. Add additive account-owned state / editor history / email-change / cleanup
   persistence, RLS and migration checks. Generate types in isolated dependencies.
2. Reading and collections: implement APIs plus bilingual reader controls and a
   personal collection page. Verify ownership, conflicting edits, offline retry,
   language separation and truthful sync states.
3. Admin recovery: autosave separate private drafts, transactional revisions and
   soft deletion / restore. Verify conflicting editors, draft privacy and bundled
   override hiding; keep unsaved-change protection.
4. Account data: explicit export, two-mailbox email change, strong deletion proof,
   safe image ownership and durable cleanup. Verify expired/replayed proof, races,
   last-admin protection and no secret export.
5. Search: bilingual body/heading search and safe snippets with stable heading
   anchors. Verify Chinese/English matches, escaping, visibility and deletions.
6. Integrate, independently review, run tests/lint/types/format/build and real HTTP
   tests in a new isolated schema. Verify browser flows and service-unavailable
   states. Commit and provide a restricted preview; report external setup blockers.

## External setup

Real email still requires the owner's sender domain and Resend key. The Google
preview callback mismatch needs a stable authorized callback or preview-specific
provider configuration; never silently send a preview OAuth flow to another host
and lose its state/cookies. Investigate available settings without exposing secrets.
