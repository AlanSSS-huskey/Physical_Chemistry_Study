# Study navigation and private backup recovery

Both additions use the existing bilingual interface and current account session.
They require no new service, dependency, environment variable, or database migration.

## Find course content

Use the header Search button or Command/Control K. The dialog searches the existing
authorized course index, supports either content language, and opens a matched
section in its actual language. Tab navigates links, Enter opens the first result,
and Escape closes the dialog and returns focus. A same-chapter language change
reloads the article; pending private writing still has a chance to veto navigation.

The chapter outline reads only visible h2/h3 headings from rendered course HTML.
It never reads a full gated source to manufacture a contents list. Existing
renderer IDs are reused for links. Formula labels use one TeX annotation and omit
generated footnote references. Scrolling changes the active indicator without
marking a chapter complete.

## Search private notes

Open Account → My bookmarks & notes → Private notes. Search matches note bodies
case-insensitively, with literal percent signs, underscores, and backslashes.
Queries are limited to 200 characters and travel only to the private library API;
they are not stored in page history or browser storage. Results retain the
existing 12-item pagination and current-account header check. Unavailable course
metadata remains hidden while the owner's original writing stays readable.

## Restore writing from an account export

Account settings → Personal data accepts a version 1
`physical-chemistry-account` JSON export. The backup is limited to 1 MiB, 100
notes, 500 bookmarks, and 5,000 characters per note. A preview compares existing
and incoming text. Keeping conflicts is the default; replacement is explicit.
Only notes and bookmarks are written. Profile, passwords, sessions, course rights,
progress, reading positions, and preferences are ignored even if present in the file.

Restoring personally supplied writing for an inaccessible or removed chapter is
permitted as a recovery exception. The operation does not reveal course titles or
grant access. A different source account ID displays a warning but does not
redirect the destination account.

The private preview endpoint signs the current destination account, normalized
backup hash, and matching destination snapshot for ten minutes. Apply requires
signed CSRF, current-account binding, confirmation, and a matching live snapshot.
It runs in a Serializable transaction with bounded bulk insertion and a
parameterized revision/body check for replacement. Stale, expired, changed-file,
cross-account, or conflicting concurrent submissions fail without partial writes.
Preview is limited to 20 requests per account per hour; apply to 5.

No private backup content, preview proof, or password belongs in logs or source
control. Do not test imports using a production user's records.
