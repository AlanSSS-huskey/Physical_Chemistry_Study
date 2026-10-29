# 学习空间 / Study workspace

All interfaces and feedback are available in Chinese and English. These features
reuse NextAuth database sessions; they do not introduce a second identity system.

## Reading and private writing

The reader saves font size (16–24 px), line height and paper theme. Signed-in
readers sync these preferences across devices. Anonymous preferences remain local.
Reading positions use the actual content language, so switching a translation
does not pretend its headings have the same coordinates. A Resume button moves
to the last saved heading or proportion; opening a chapter never jumps silently.
Reading position is independent of the explicit chapter-completion action.

Bookmarks are shared across translations. Private chapter notes are plain text,
limited to 5,000 characters, and saved separately for Chinese and English.
`/account/library` lists bookmarks, complete own notes and recent reading, with
12 items per page. Losing access or trashing a chapter does not remove its owner's
writing; unavailable chapter titles/links are withheld.

Authenticated study requests bind `X-Study-User` to the current session. Notes,
positions and preferences use optimistic revisions. A stale revision returns 409
with the current allowlisted state. Conflict resolution requires an explicit
choice. Failed saves retain the in-memory edit and offer retry. Private text is
never written to browser storage. Closing, following a link, changing language
or signing out while notes are pending triggers an unsaved-writing prompt.

## Search

`/notes?q=...` and `GET /api/search?q=...&locale=zh|en&subject=...` search the
public catalog in both languages. Authorization is resolved before body parsing:
only the visible preview may be indexed for a gated chapter. Denied, unpublished
and trashed records are excluded. Entitled private chapters are not part of the
public-catalog search. Results deduplicate language fallbacks and show plain-text
snippets with stable generated `section-*` anchors. The matched content language
is selected before opening its link. Query length is limited to 200 characters,
with at most 100 ranked results. An unavailable source displays an incomplete
results notice, not a false empty result.

## Account data

The Data & email section of `/account/settings` provides a JSON attachment export
with an explicit allowlist. It includes only the current user's profile and study
data, and excludes password hashes, OAuth credentials, proof tokens and sessions.
Private responses use `Cache-Control: no-store`.

Email changes require the current password when one exists and separate
30-minute proofs delivered to both the old and new inbox. Provider acceptance
activates the proofs; a partial failure invalidates the request. Opening a link
only shows a masked summary. Explicit confirmation consumes one proof; completing
both changes the email and revokes every session and outstanding recovery proof.

Account deletion requires typing `DELETE`. Password accounts also require their
current password. Google-only accounts receive a 30-minute email proof with a
separate confirmation step. Serializable transactions preserve the last admin.
Private account data and sessions cascade away. Shared article illustrations,
including images referenced in drafts or immutable revisions, remain available.
Unreferenced owned avatar cleanup is queued durably if object storage fails.
Administrators can retry a bounded batch in Data & email; this is a manual retry,
not an automatically scheduled worker.

## Release

The sixth Prisma migration adds nine private tables, content versions/trash and
image purpose/nullable ownership. It enables RLS and revokes all direct privileges
from PUBLIC, anon and authenticated for the nine new tables. Server-side database
authorization remains authoritative. Generate Prisma and apply the migration to
the verified application database before deploying this code.

Real email delivery requires an owned sender domain and Resend setup. No test
capture, fake provider key, test inbox or development deletion endpoint ships in
the app. Follow the separate email and admin-recovery runbooks. Production
publishing and anonymous preview sharing require the outstanding release approval.
