# M6.2 — Critical Fixes & Security Remediation

## Remediation scope

Reviewed `M6_1_AUDIT_REPORT.md`. The audit contained no critical findings and one high-severity finding (`FE-01`: missing frontend/browser automation). Medium findings addressed in this slice: `DATA-01` (activity idempotency) and `SEC-01` (owner isolation evidence for newer resources).

## Findings resolved

- **DATA-01 (Medium):** Activity duplicate detection now keys on `userId + idempotencyKey` instead of also requiring the same nullable `documentId`, reducing duplicate records for retries without a document.
- **SEC-01 (Medium):** Added integration coverage verifying user isolation for writing goals and preferences.

## Findings still open

- **FE-01 (High):** No frontend test runner or browser automation exists. Approved remediation plan remains to add these in a future slice.
- **FE-02, FE-03, SEC-02, SEC-03, SEC-04, FE-04, FE-05, DATA-02, DATA-03, DATA-04:** Remain open per M6.1 plan.

## Files changed

- `apps/api/src/services/resource-lifecycle.js`
- `apps/api/test/lifecycle.integration.test.js`

## Regression tests added

- `deduplicates writing activity by user and idempotency key`
- `isolates writing goals and preferences by user`

## Verification results

- `pnpm lint`: passed
- `pnpm typecheck`: passed
- `pnpm test`: passed (50 API tests, 3 validation tests)
- `pnpm test:integration`: passed (9 PostgreSQL tests)
- `pnpm build`: passed
- `pnpm format:check`: passed

## Remaining risks

- Frontend behavior remains manually verified only.
- Activity recording is still not connected to editor autosave.
- Preferences are persisted but not fully applied to application styling.
- Rate limiting and cookie hardening remain single-instance/deployment concerns.
  EOF
