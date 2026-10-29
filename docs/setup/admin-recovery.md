# Editor recovery

The editor autosaves unfinished bilingual writing to `ContentDraft`, scoped to
the signed-in administrator. Autosave never changes a public article. A recovery
prompt lets the administrator recover or discard their own draft; a second tab
cannot silently overwrite it because every write compares the draft revision.

An explicit article save creates an immutable `ContentRevision`. Existing
articles preserve a baseline on the first change. Saves, trash actions and
restores increment `Content.version` inside a transaction, with an
`expectedVersion` comparison to reject stale editors. A successful article save
removes only the exact private draft revision included in that save.

Trash sets `deletedAt` and unpublishes the article. Its original slug stays in the
database so a bundled source cannot reappear underneath the deleted override.
Restoring an article or a historical revision always creates a new unpublished
version. The administrator reviews it and publishes explicitly. History is
paginated in batches of 50; earlier versions remain available.

All API reads check administrator access and disable caching. Private-draft
requests also bind `X-Admin-User` to the administrator rendered into the editor,
so switching accounts in another tab cannot write private text into the new
administrator's drafts. Mutations also
require the existing signed account CSRF cookie, matching `Origin`, and JSON.
Bodies are streamed with a 6,000,000-byte cap. The previous 2 MB limit rejected
valid 300,000-character bilingual content because the editor includes both
translations and a canonical body, which can exceed 2 MB in UTF-8. Field-level
limits remain unchanged, and autosave payloads accept only editor fields.

On failed autosave, the editor stops claiming success and offers an explicit
retry. Conflicts preserve the current writing and provide a copyable backup.
The unsaved-work navigation guard remains active until an explicit article save.
No permanent article-delete endpoint or old destructive server action remains.
