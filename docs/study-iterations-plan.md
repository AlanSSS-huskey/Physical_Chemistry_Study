# Two study usability iterations

The owner requested two autonomous improvement rounds after approving the
production release. Keep both Chinese and English, reuse existing account and
content authorization, and add no paid dependencies or database migrations.

## Round 1: find and navigate course content

- Open a global quick-search dialog with the header button or Command/Control K.
- Reuse the authorized `/api/search` index; show loading, errors, partial results,
  and empty states. Trap focus, support Escape, and restore focus on close.
- Follow a result in its actual content language, including results for another
  language of the current chapter. Respect unsaved-writing navigation guards.
- Build the chapter contents list from rendered, visible heading IDs only. Keep
  deep links and current-section tracking consistent with the actual article.

## Round 2: recover and find private writing

- Search the current account's private note bodies through the existing private
  library API. Bound queries to 200 characters, use literal case-insensitive
  matching, and preserve pagination. Never put a query in page history or storage.
- Import only notes and bookmarks from a version 1 account export. Reject files
  over 1 MiB, more than 100 notes, more than 500 bookmarks, invalid identities,
  duplicate identities, and note bodies over 5,000 characters.
- Preview new, identical, and conflicting notes before any mutation. Default to
  keeping existing writing; replacing conflicts requires an explicit choice.
- Bind signed previews to the current account, normalized backup, and destination
  snapshot for ten minutes. Apply atomically; reject stale, tampered, expired, or
  cross-account previews. Require signed CSRF and current-account headers.
- Restoring user-provided writing for removed or inaccessible chapters is allowed
  as a recovery exception. It grants no course permissions and reveals no hidden
  chapter metadata. Profile, sessions, progress, roles, and entitlements never
  change during import.

## Validation and release

Use test-first checks for new logic, then type/lint/format checks and a production
build. Verify both rounds in a real browser and exercise private-data operations
against a disposable, uniquely named test schema with synthetic accounts. Preserve
the production database and unrelated schemas, remove owned test fixtures, review
the final changes, then publish through the existing GitHub/Vercel project. Email
delivery still needs the owner's sending domain and provider credentials; do not
claim it works before actual delivery is verified.
