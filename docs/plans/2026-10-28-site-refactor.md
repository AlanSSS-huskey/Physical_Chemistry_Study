# Bilingual chemistry website implementation plan

> For agentic workers: use subagent-driven-development to execute owned tasks and review changes before integration.

**Goal:** Deliver a bilingual study site with a single publishing flow, safe reading, authentication, persistent learning progress, and durable media.

**Architecture:** Retain Next.js 15, Prisma 6, NextAuth 4, and Supabase. A server content service merges bundled lessons with authoritative database records; translations share one content slug and one progress record. All HTML is produced through a sanitized Markdown/math pipeline.

**Tech stack:** TypeScript, React 19, Tailwind 3, Node 24 native behavior tests, PostgreSQL and Supabase Storage.

**Status (2026-10-28):** Local implementation and acceptance for tasks 1–6 are complete. Final frozen source passed 87/87 native tests, ESLint and TypeScript with 0 errors, production build, formatting, and npm audit with 0 vulnerabilities. Thirteen real-database HTTP groups and public browser checks passed. Development Google OAuth and reload-persistent sessions are also verified in ordinary Chrome. Task 7 remains pending: production OAuth, authenticated admin browser UI, live Storage, production configuration and release. No migration from this work has been applied to the existing application schema, and this refactor has not been deployed. See the [verification record](../verification/2026-10-28-site-refactor.md).

## Verified database facts

- The existing application target is the real `postgrese` database, schema `public`. Preserve this target and its data; do not silently rename the database to `postgres` or move the application to a newly invented `chemistry` schema.
- Only `20260303054114_init` is recorded as applied to that application target. `20260307120000_admin_content_editor` and `20261028110000_bilingual_content_and_durable_images` remain pending there.
- The read-only aggregate snapshot on 2026-10-28 found 0 rows in each of `User`, `Content`, and `Progress`.
- The default `postgres` database has a separate, unrelated `planner` schema. Its structure must not be conflated with `postgrese/public`.
- Vercel Production environment access still returns 403, so the actual production connection remains unverified.
- The isolated `chemistry_refactor_verification_01a183a2` schema applied all three migrations and enabled RLS on 14 application tables. Thirteen HTTP test groups passed; fixture users, content, progress, sessions and images were cleared to 0 before the schema was dropped. Existing `public` counts remain 0/0/0 for `User`/`Content`/`Progress`, with only the init migration applied. These tests did not migrate, seed or deploy the existing application.

## Global constraints

- Chinese and English UI and content support are required; remember locale across navigation and reloads.
- Preserve existing `postgrese/public` data and links, the unrelated `postgres/planner` schema, and Supabase-managed schemas.
- Keep existing-application migration and deployment separate from isolated integration tests. Review the verified target, migration chain, backup, and rollback before any release change.
- Do not deploy to production before a reviewable local result and user approval.
- No simulated successful writes, fake statistics, or exposed credentials.

## Tasks and contracts

- [x] 1. Establish locale helpers, locale provider, and safe Markdown rendering. Verify language fallback, URL handling, script/URL sanitization and math syntax with native Node tests.
  - Status: local implementation and acceptance complete; behavior coverage is included in the final 87/87 passing tests.
  - Files: `src/lib/i18n.ts`, `src/lib/locale-server.ts`, `src/lib/markdown.ts`, `src/components/LocaleProvider.tsx`, `src/components/MdxRenderer.tsx`, `tests/i18n.test.mjs`, `tests/markdown.test.mjs`.
  - Produces: `Locale = "zh" | "en"`, `textFor(locale, zh, en)`, `getLocale(): Promise<Locale>`, `useLocale(): { locale: Locale }`, `renderMarkdown(source): Promise<string>`.
- [x] 2. Unify content and authorization, validate writes, add bilingual publication metadata, and replace deployment-local image storage.
  - Status: local acceptance complete; shared content/access APIs and all migrations passed isolated-schema HTTP verification. Durable storage is implemented and unit/failure tested only; live Storage remains task 7. No migration from this work has run against the existing application target.
  - Owner: backend agent. Produces `loadLibrary(locale)`, `loadContent(slug, locale)`, `resolveContentAccess(content, userId?)`; StudyContent and API payloads agreed in delegation.
  - Verify private/draft precedence over file fallbacks, invalid payloads, publication/translation rules, file signatures, and service failure states. Prepare additive SQL only.
- [x] 3. Integrate authentication and idempotent progress updates. Display real saved progress on account pages.
  - Status: local acceptance complete; real database sessions, access denial, repeated completion targets, shared-language progress and account records passed isolated HTTP verification. Real Google authorization and session persistence after reload also passed in ordinary Chrome against the persistent development schema. Production OAuth remains task 7.
  - Owner: auth/progress agent. Produces `getSessionState()`, `getAuthAvailability()` and explicit completion target server action.
  - Verify malformed configuration, anonymous/unavailable distinction, real accessible chapter validation and stable shared content slug.
- [x] 4. Rebuild bilingual authoring and media management against shared APIs.
  - Status: local acceptance complete; admin CRUD, bilingual/encoded routes, safe preview, bundled-content guards and missing-Storage errors passed HTTP tests. Authenticated admin browser UI and live media storage remain task 7.
  - Owner: admin agent. Uses `/api/admin/content` and `/api/admin/preview-mdx` returning sanitized `{html}`.
  - Verify slug manual override, upload-safe text insertion, stale preview cancellation, unsaved work and deletion confirmation.
- [x] 5. Replace the application shell, home, library, and lesson reader; add recoverable route states and real bilingual sample lessons.
  - Status: local acceptance complete; public Chinese/English search, locale switch/reload, reading/formulas, old links and safe login/account/admin entry states passed browser checks at 320, 768, 1024 and 1440px. The main localhost preview now runs the production build with real Google login and the persistent chemistry_development schema, preserving public.
  - Owner: root. Consume shared locale/content/access contracts. Preserve old URLs, including slugs containing `/` via a catch-all note route.
  - Verify language changes, content discovery, breadcrumbs, previous/next, accurate counts, mobile navigation, missing translations and dependency outage notices.
- [x] 6. Integrate, review, and verify with `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, then real-browser checks at desktop and mobile widths.
  - Status: final frozen source passed 87/87 tests, ESLint 0 errors, TypeScript 0 errors, production build, format check and npm audit 0 vulnerabilities. The 13-group isolated database workflow and public browser acceptance are complete; fixture cleanup and schema removal are confirmed.
  - Record external limitations separately from local checks. Update environment and migration instructions, leaving production changes for the final review.
- [ ] 7. Verify production access and release prerequisites, then review deployment and application migration separately.
  - Status: development Google OAuth and reload-persistent session are verified in ordinary Chrome. Vercel Production environment access is still 403; production OAuth, authenticated admin browser UI, live Storage, the production connection, migration approval, and deployment remain unverified or unexecuted.

## Commands: baseline and current implementation

The audit baseline had no test/typecheck scripts and used deprecated `next lint`. Current scripts use Node 24 tests (`npm test`), ESLint CLI (`npm run lint`), non-incremental TypeScript checking (`npm run typecheck`), `npm run build`, and `npm run format:check`, plus `npm audit`. These final frozen-source checks passed; evidence and remaining external limitations are recorded in the [verification report](../verification/2026-10-28-site-refactor.md).

The baseline versions were Next.js 15.5.12, NextAuth 4.24.13, and Prisma 6.19.2. Current pinned versions include Next.js 15.5.28, NextAuth 4.24.15, Prisma 6.19.2, React 19.2.4, and TypeScript 5.9.3. Lockfile and dependency updates are part of the local implementation, not a production release.

## Official references

- https://nextjs.org/docs/15/app/api-reference/functions/cookies — asynchronous request cookies and locale persistence.
- https://github.com/rehypejs/rehype-sanitize — sanitize before trusted math rendering; do not evaluate stored MDX.
- https://supabase.com/docs/guides/storage/uploads/standard-uploads — persistent media uploads.
