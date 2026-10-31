# M8.7 — Worldbuilding Browser Regression

## Browser workflows covered

- Create a world.
- Reopen the world after reload.
- Create two world entries of different types.
- Verify persistence after reload.

## Persistence results

- World creation and reload persistence are verified.
- Entry creation is fixed to use a valid editor document payload.

## Relationship and document-link behavior

- Relationship and document-link browser coverage remains limited.

## Ownership-isolation coverage

- Not automated in browser tests; API/service ownership checks exist.

## Defects discovered and fixes

- `WorldsScreen` sent `content: {}` for new entries, which failed validation. Fixed to send `{ type: "doc", content: [] }`.

## Unsupported or untested operations

- Relationship creation/removal browser coverage.
- Document linking browser coverage.
- Cross-account browser isolation.

## Verification results

- `pnpm lint`: passed
- `pnpm typecheck`: passed
- `pnpm test`: passed (50 API tests, 3 validation tests)
- `pnpm test:integration`: passed (9 PostgreSQL tests)
- `pnpm build`: passed
- `pnpm format:check`: passed
- `pnpm test:e2e`: passed (8 browser tests)
  EOF
