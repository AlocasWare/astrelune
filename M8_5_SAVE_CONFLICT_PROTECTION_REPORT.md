# M8.5 — Failed-Save & Concurrency Protection Browser Testing

## New browser scenarios

- Failed save preserves editor content.
- Stale-version conflict preserves unsaved content.

## How failures and conflicts were simulated

- Playwright route interception returned HTTP 500 for the first save attempt.
- Playwright route interception returned HTTP 409 for subsequent saves.

## Evidence

- The editor retains unsaved content after a failed save.
- The editor retains unsaved content after a stale-version conflict.
- Save status feedback is displayed.

## Tests added

- `e2e/conflict.spec.ts` contains 2 browser tests.

## Remaining limitations

- Overlapping save ordering was not fully automated.
- Retry after a 500 is not supported by the application; only conflict retry behavior is exercised indirectly.

## Verification results

- `pnpm lint`: passed
- `pnpm typecheck`: passed
- `pnpm test`: passed (50 API tests, 3 validation tests)
- `pnpm test:integration`: passed (9 PostgreSQL tests)
- `pnpm build`: passed
- `pnpm format:check`: passed
- `pnpm test:e2e`: passed (6 browser tests)
  EOF
