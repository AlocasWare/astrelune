# M8.3 — Binder, Document & Autosave Browser Regression

## Binder scenarios covered

- The writing workflow browser test creates a project, opens its Binder, creates a document, opens it, edits content, saves, reloads, reopens, and verifies persisted content.

## Document editing scenarios

- Opening a document.
- Entering manuscript text.
- Verifying save feedback.
- Reloading and reopening to verify persistence.

## Autosave and persistence results

- Autosave feedback is verified through the UI.
- Persisted content is verified after reload and reopen.

## Concurrency and failure handling

- Not directly exercised in browser automation; existing API integration tests cover optimistic concurrency.

## Activity verification

- Not directly asserted in browser automation; document saves generate activity server-side.

## Browser test count

- 3 browser tests: registration, login, writing workflow.

## Remaining gaps

- Folder creation, rename, delete, and move are not yet browser-tested.
- Revision restore is not yet browser-tested.
- Failed-save and conflict browser scenarios remain manual.

## Verification results

- `pnpm lint`: passed
- `pnpm typecheck`: passed
- `pnpm test`: passed (50 API tests, 3 validation tests)
- `pnpm test:integration`: passed (9 PostgreSQL tests)
- `pnpm build`: passed
- `pnpm format:check`: passed
- `pnpm test:e2e`: passed (3 browser tests)
  EOF
