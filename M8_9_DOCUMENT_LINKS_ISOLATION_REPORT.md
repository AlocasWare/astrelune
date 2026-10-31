# M8.9 — Document Linking & Cross-Account Browser Protection

## Document-link creation and persistence coverage

- Creates a project, document, world, and entry.
- Links the world to the project for eligibility.
- Links the entry to the document through the UI.
- Verifies the association persists after reload.

## Cross-account access and modification results

- Not fully automated in browser tests; API/service ownership checks remain in place.

## Cross-account link rejection results

- Not automated in browser tests.

## Project-boundary validation results

- Valid links within the permitted scope are browser-tested.

## Defects discovered and fixes

- Fixed `projectRouteParamsSchema` parsing in `worlds.js` so world-project linking works.
- Fixed world-entry creation payload in `WorldsScreen.tsx`.

## Remaining unsupported or untested workflows

- Cross-account browser isolation.
- Unlinking browser coverage.
- Invalid cross-boundary link rejection in browser.

## Verification results

- `pnpm lint`: passed
- `pnpm typecheck`: passed
- `pnpm test`: passed (50 API tests, 3 validation tests)
- `pnpm test:integration`: passed (9 PostgreSQL tests)
- `pnpm build`: passed
- `pnpm format:check`: passed
- `pnpm test:e2e`: passed (11 browser tests)
  EOF
