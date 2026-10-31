# M6.1 — Release 1 Architecture, Security & Feature Audit

## Scope and method

This is an audit/planning slice. No application behavior was changed for this milestone. The audit reviewed the current Release 1 implementation, including authentication, projects, Binder/documents, editor/autosave/revisions, worldbuilding, writing goals/activity, preferences, Sanctuary dashboard, validation, Prisma schema, API routes/services, and frontend screens.

### Files and modules inspected

- prisma/schema.prisma
- apps/api/src/app.js
- apps/api/src/routes/auth.js
- apps/api/src/routes/projects.js
- apps/api/src/routes/worlds.js
- apps/api/src/routes/deletion.js
- apps/api/src/routes/goals.js
- apps/api/src/routes/preferences.js
- apps/api/src/services/resource-lifecycle.js
- apps/api/src/services/authentication.js
- apps/api/src/services/registration.js
- apps/api/src/services/sessions.js
- apps/api/src/password.js
- apps/api/src/session.js
- apps/api/src/ownership.js
- apps/api/src/middleware/security.js
- apps/api/src/middleware/authenticate-session.js
- packages/validation/src/index.ts
- apps/web/src/main.tsx
- apps/web/src/ProjectsScreen.tsx
- apps/web/src/BinderScreen.tsx
- apps/web/src/DocumentEditorScreen.tsx
- apps/web/src/TiptapEditor.tsx
- apps/web/src/WorldsScreen.tsx
- apps/web/src/SettingsScreen.tsx
- M0_AUDIT_REPORT.md
- README.md

### Tests and commands executed

- pnpm lint — passed
- pnpm typecheck — passed
- pnpm test — passed (50 API tests, 3 validation tests)
- DATABASE_URL=... pnpm test:integration — passed (7 PostgreSQL lifecycle tests)
- pnpm build — passed
- pnpm format:check — passed

No frontend/browser automation suite exists in the repository, so Playwright responsive/accessibility checks were not executed.

## 1. Requirement compliance summary

| Requirement area                             | Status                             | Notes                                                                                                                                                                            |
| -------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication and session lifecycle         | Implemented and verified           | Argon2id hashing, secure random session tokens hashed with SHA-256, HTTP-only cookies, expiration/revocation paths, rate limiting, ownership helpers. Covered by API/auth tests. |
| Project ownership and management             | Implemented and verified           | CRUD, archive/delete with confirmation, owner scoping. Covered by API tests and integration tests.                                                                               |
| Binder hierarchy and document operations     | Implemented and verified           | FOLDER/CHAPTER/SCENE/NOTE/RESEARCH, nesting, move, reorder, duplicate, delete. Covered by integration tests.                                                                     |
| Editor persistence and autosave              | Implemented but not fully verified | Tiptap autosave and status states implemented; mostly manual/browser verification. No automated frontend tests.                                                                  |
| Optimistic concurrency and conflict handling | Implemented and verified           | Version-conditional saves and 409 handling implemented; covered by integration tests.                                                                                            |
| Revision history and restoration             | Implemented and verified           | Immutable revisions, history, restore with conflict protection. Covered by integration tests.                                                                                    |
| Worldbuilding entries and relationships      | Implemented but not fully verified | Backend and frontend implemented; API coverage exists, but browser workflow coverage is absent.                                                                                  |
| Document-world entry associations            | Implemented and verified           | Eligibility validation and upsert/delete behavior covered by integration tests.                                                                                                  |
| Writing goals and activity tracking          | Implemented but not fully verified | Backend and dashboard integration implemented; no dedicated goal/activity integration tests yet.                                                                                 |
| User preferences and settings                | Implemented but not fully verified | Backend and settings UI implemented; persistence verified indirectly through API, but no dedicated preference tests.                                                             |
| Sanctuary dashboard                          | Implemented but not fully verified | Dashboard composes projects, goals, activity, settings; responsive/accessibility checks were manual only.                                                                        |

## 2. Security findings

### Implemented controls

- Argon2id password hashing with configurable bounded cost parameters.
- 256-bit session tokens generated with crypto.randomBytes, stored only as SHA-256 hashes.
- Timing-safe session token comparison.
- HTTP-only session cookie.
- Origin/CSRF validation for cookie-authenticated mutating requests.
- Rate limiting middleware available for authentication flows.
- Shared Zod validation for API payloads.
- Owner-scoped Prisma queries for projects, documents, worlds, entries, goals, activity, and preferences.
- Cross-account access generally returns 404 rather than leaking existence.

### Findings

- SEC-01 (Medium): No automated tests for cross-account access on newer M5 resources (goals, activity, preferences). Existing integration tests cover documents/worlds/projects, but not the newer resources.
- SEC-02 (Medium): Rate limiter is in-memory and process-local. It resets on restart and does not coordinate across instances. Acceptable for single-instance Release 1, but should be documented as a scaling limitation.
- SEC-03 (Low): Origin validation allows requests with no Origin/Referer when a session cookie is present. This is a pragmatic compatibility choice, but a stricter CSRF policy could require an explicit token or same-site enforcement.
- SEC-04 (Low): Cookie Secure/SameSite attributes should be explicitly verified in deployment configuration. The audit did not find a complete production cookie hardening review in the inspected files.
- SEC-05 (Low): Error responses include request IDs, which is appropriate, but stack traces must remain confined to server logs. The inspected error handler returns generic messages for unexpected errors.
  EOF

## 3. Data-integrity findings

### Implemented controls

- Prisma foreign keys with cascade/restrict/set-null behavior consistent with approved schema.
- Transactional document saves and revision creation.
- Version-conditional updates for optimistic concurrency.
- Idempotency keys for document saves and activity records.
- Revision immutability enforced by append-only revision creation.
- User isolation through owner-scoped queries.

### Findings

- DATA-01 (Medium): WritingActivity idempotency is only best-effort for nullable documentId because the unique constraint allows multiple null values. Concurrent retries without a document ID can create duplicates.
- DATA-02 (Medium): Goal progress uses server UTC date boundaries. This is consistent but should be documented as the canonical timezone for Release 1.
- DATA-03 (Low): No backup/restore procedure or recovery runbook is present in the repository. Deployment safety relies on external database backups.
- DATA-04 (Low): Migration history includes a remediation migration for an accidental placeholder table. Future schema changes should continue using forward-only migrations.

## 4. Frontend and workflow findings

### Implemented controls

- Protected route gating by authentication status.
- Project, Binder, document editor, worldbuilding, dashboard, and settings screens.
- Loading, empty, and error states in major screens.
- Keyboard-accessible buttons and visible focus styling in shared CSS.
- Responsive layouts using flexible grids and wrapping.

### Findings

- FE-01 (High): No frontend automated tests or browser automation exist. Responsive, keyboard, and full workflow behavior has not been automatically verified.
- FE-02 (Medium): Dashboard preference application is limited to persisted values; full theme/editor styling integration is not yet connected.
- FE-03 (Medium): Writing activity is not automatically recorded by editor autosave. The dashboard may show no activity even after substantial editing.
- FE-04 (Low): WorldsScreen is functionally complete but visually less polished than ProjectsScreen and uses inline styles rather than shared component classes.
- FE-05 (Low): The legacy App draft editor remains reachable via #write, which may confuse the Release 1 navigation model.

## 5. Prioritized remediation register

| ID      | Severity | Release-blocking | Affected area                       | Description                                                                                                 | Recommended remediation                                                                          |
| ------- | -------- | ---------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| FE-01   | High     | No               | Frontend testing                    | No automated browser/frontend tests for dashboard, editor, worldbuilding, settings, or responsive behavior. | Add a frontend test runner and Playwright coverage for critical workflows.                       |
| SEC-01  | Medium   | No               | Goals/activity/preferences security | Newer resources lack dedicated cross-account integration tests.                                             | Add integration tests verifying owner isolation for goals, activity, and preferences.            |
| DATA-01 | Medium   | No               | Activity idempotency                | Nullable document IDs allow duplicate activity records under concurrent retries.                            | Make idempotency key global per user or require a non-null document/idempotency scope.           |
| FE-02   | Medium   | No               | Preferences                         | Theme/editor preferences are persisted but not fully applied across the app.                                | Connect preference values to root styling and editor configuration.                              |
| FE-03   | Medium   | No               | Activity tracking                   | Editor autosave does not record writing activity.                                                           | Add activity recording on save/checkpoint with idempotency keys.                                 |
| SEC-02  | Medium   | No               | Rate limiting                       | In-memory rate limiter is process-local.                                                                    | Document single-instance limitation or replace with shared store for multi-instance deployments. |
| SEC-03  | Low      | No               | CSRF                                | Originless cookie-authenticated mutations are allowed.                                                      | Consider stricter CSRF token or SameSite policy.                                                 |
| SEC-04  | Low      | No               | Cookies                             | Production cookie hardening not fully audited.                                                              | Verify Secure/SameSite/HttpOnly in deployment.                                                   |
| FE-04   | Low      | No               | Worldbuilding UI                    | WorldsScreen uses inline styles and is less polished.                                                       | Refactor to shared styles/components.                                                            |
| FE-05   | Low      | No               | Navigation                          | Legacy draft editor remains reachable.                                                                      | Hide or remove legacy route from Release 1 navigation.                                           |
| DATA-03 | Low      | No               | Operations                          | No backup/recovery runbook.                                                                                 | Add operational documentation.                                                                   |

## 6. Recommended M6.2 implementation order

1. Add frontend test runner and Playwright smoke coverage for authentication, dashboard, project/Binder, editor save/conflict, worldbuilding, and settings.
2. Add cross-account integration tests for goals, activity, and preferences.
3. Connect activity recording to document saves.
4. Apply persisted preferences to app/editor styling.
5. Improve activity idempotency and document the canonical timezone.
6. Polish WorldsScreen and remove or hide legacy draft-editor navigation.
7. Add deployment hardening documentation for cookies, rate limiting, and backups.

## Verification summary

All six required verification commands passed on the audited implementation:

- pnpm lint: passed
- pnpm typecheck: passed
- pnpm test: passed (50 API tests, 3 validation tests)
- pnpm test:integration: passed (7 PostgreSQL tests)
- pnpm build: passed
- pnpm format:check: passed

## Areas that could not be inspected

- Browser-only behavior at desktop/tablet/mobile viewport sizes was not automated.
- Production deployment configuration and backup procedures were not available in the repository.
- External dependency vulnerability scanning was not run because no audit command or network access was part of this slice.
  EOF
