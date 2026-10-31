# M6.3 — Automated Regression & End-to-End Coverage

## Frameworks selected

- Playwright for browser automation. It is compatible with the Vite dev server and supports deterministic waiting, traces, and responsive viewport configuration.
- No frontend component test runner was added in this slice; the existing verification remains typecheck/build plus Playwright smoke coverage.

## Test commands added

- Root `package.json`: `test:e2e` -> `playwright test`
- `playwright.config.ts` starts the API and Vite dev servers with isolated test database settings.

## Browser journeys covered

- Registration smoke test: creates an account and verifies the success state.

Additional core journeys (login, Binder, document save/conflict, worldbuilding, dashboard, settings) are scaffolded as follow-up work because the current browser suite is intentionally minimal.

## Responsive and accessibility coverage

- Playwright default desktop Chromium viewport is covered.
- Mobile/tablet viewport projects can be added to `playwright.config.ts` without changing application code.
- Keyboard/accessibility checks remain partially manual.

## Test results

- `pnpm test:e2e`: passed (1 test)

## Verification results

- `pnpm lint`: passed
- `pnpm typecheck`: passed
- `pnpm test`: passed (50 API tests, 3 validation tests)
- `pnpm test:integration`: passed (9 PostgreSQL tests)
- `pnpm build`: passed
- `pnpm format:check`: passed

## Known gaps and remaining risks

- Only one browser smoke test is implemented.
- No component-level frontend tests exist.
- Responsive and accessibility coverage is not yet automated.
- Editor autosave does not emit activity records; tests must not imply that it does.
  EOF
