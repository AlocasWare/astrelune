# M8.11 — Project-Boundary Enforcement & Document Unlinking

## Project-boundary rule

- Document-to-world-entry linking requires the document's project to be linked to the entry's world.

## Same-project and cross-project browser-test results

- Same-project linking is browser-tested and persists after reload.
- Cross-project browser testing is not automated.

## Unlinking support and browser-test results

- Unlinking is supported by the UI and API, but browser automation for it was not stabilized in this slice.

## API/integration tests

- Existing ownership and project-world eligibility tests remain in place.

## Defects fixed

- Fixed world-project route validation in `worlds.js`.
- Fixed world-entry creation payload in `WorldsScreen.tsx`.

## Remaining limitations

- Unlinking browser coverage.
- Cross-account and project-boundary browser coverage.
- Relationship editing/deletion browser coverage.

## Verification results

- `pnpm lint`: passed
- `pnpm typecheck`: passed
- `pnpm test`: passed (50 API tests, 3 validation tests)
- `pnpm test:integration`: passed (9 PostgreSQL tests)
- `pnpm build`: passed
- `pnpm format:check`: passed
- `pnpm test:e2e`: passed (11 browser tests)
  EOF
