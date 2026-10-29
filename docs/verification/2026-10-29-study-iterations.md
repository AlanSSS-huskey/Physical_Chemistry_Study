# Two study usability iterations: verification

The owner requested two autonomous rounds after authorizing publication. The
changes keep the existing project, production domain, and six database migrations.
No new environment variables, paid services, or dependencies are required.

## Round 1

Global authorized course search is available from the header and Command/Control K.
The native modal handles loading, partial/error/empty responses, focus wrapping,
Escape, and focus restoration. Search links open the result's actual content
language, including a different language of the same chapter. Existing writing
guards remain in place.

The chapter outline uses visible rendered heading IDs. Review and browser testing
found two issues and led to regression fixes: duplicate KaTeX/footnote label text,
and the last section's active state when the document cannot scroll any farther.
Neither outline interaction marks content complete.

## Round 2

Private note search retains owner binding and pagination, matches bilingual text
case-insensitively, and treats SQL pattern punctuation literally. Unavailable
chapter metadata remains hidden while the owner's text stays accessible.

Backup recovery imports only notes and bookmarks. It previews differences, keeps
existing conflicts by default, and requires confirmation for an atomic apply.
Signed ten-minute proofs bind the destination account, normalized file, and target
snapshot. Related records changing after preview cause a stale error; no partial
writes are accepted.

## Automated and HTTP verification

- 239 automated tests passed, including new navigation, outline, search, backup
  parser, proof, conflict, rate-limit, and UI helper cases.
- Lint, TypeScript, formatting, and diff whitespace checks passed.
- Real private-search HTTP tests passed three groups / 34 assertions: account
  boundaries, literal percent/underscore/backslash matching, bilingual queries,
  pagination, revoked-course metadata, and no public indexing of private text.
- Real import HTTP tests passed seven groups / 96 assertions: signed CSRF,
  current-account checks, no-store responses, bounded streaming and file validation,
  preview statuses, default keep, explicit replacement through real bulk SQL,
  signed expiry and tampering, stale rollback, cross-account proofs, and concurrent
  submission with exactly one winner.
- Tests used synthetic accounts in a uniquely named disposable schema with fake
  Google credentials and captured email transport. No production user records were
  used as fixtures and no real emails were sent.

The first private HTTP harness run hit a transport error after intentionally
canceling an oversized upload. The server stayed healthy. The isolated harness
disabled connection reuse for those adversarial requests; the complete suite then
passed. Application code was not changed for that harness behavior.

## Final browser and build checks

The final production build passed. In the browser, Chinese and English results
opened the correct article language and heading, including a language change
within the same chapter. Command K, Escape, focus return, forward/backward Tab
wrapping, and the empty-search message were verified.

The outline's native anchor offset initially added heading margin to the root's
existing scroll padding. Aligning their combined offset with the active marker
fixed the observed mismatch; the final clicked section was then confirmed active
in a fresh build. Formula/footnote labels and true document-end selection have
dedicated regression tests.

Private search for a literal percent sign showed exactly the matching owned note
and left the browser address at `/account/library`. A real file-picker upload
loaded a synthetic backup. The preview displayed original text, a cross-account
source warning, one new note, one conflict, and one new bookmark, with keeping
existing text selected and confirmation initially disabled. Confirming produced
one created note, zero updated notes, one skipped conflict, and one added bookmark.

An earlier Chrome file-picker automation call stalled despite its requested
timeout. A bounded retry in the in-app browser completed the upload; the import
preview and confirmation were then verified there. No application workaround was
needed.

Read-only preservation checks confirmed production/planner definitions and
privileges, independent development data, and production account totals were
unchanged. A concurrent planner state change was observed from the other
application; this work neither wrote nor rolled it back.

## Activation

Use the existing [feature activation guide](../setup/feature-activation.md).
The two rounds activate with the application deployment. Transactional email
remains unavailable until the owner verifies a sending domain and configures
Resend credentials; these iterations do not change that requirement.
