# M8.2 — Browser Project-Loading Investigation & Stabilization

## Original failure

The writing workflow browser test failed while loading projects after login.

## Reproduction

- Register a user.
- Log in through the browser.
- Observe the dashboard attempting to load projects.

## Root cause

The API server initialized lifecycle services with `authenticate: async () => null`, causing every authenticated resource request to fail with `UNAUTHENTICATED`. Browser requests through the Vite proxy were same-origin, but the API could not resolve the authenticated user.

## Application versus environment assessment

- Application defect: yes.
- Environment issue: Playwright originally used cross-origin API requests, which also prevented cookie-based authentication.

## Fixes implemented

- `apps/api/src/server.js`: lifecycle services now authenticate principals using `principal.userId`.
- `apps/web/vite.config.ts`: added a development proxy for API routes.
- `playwright.config.ts`: set `VITE_API_URL` to an empty string for browser tests.
- `apps/api/src/routes/auth.js`: made the auth rate limit configurable for test environments.

## Browser test outcome

- Project loading and the full writing workflow now pass in Playwright.

## Remaining limitations

- Only the writing workflow browser test covers project creation and editing.
- Revision recovery and worldbuilding browser tests remain future work.

## Verification results

- `pnpm lint`: passed
- `pnpm typecheck`: passed
- `pnpm test`: passed (50 API tests, 3 validation tests)
- `pnpm test:integration`: passed (9 PostgreSQL tests)
- `pnpm build`: passed
- `pnpm format:check`: passed
- `pnpm test:e2e`: passed (3 browser tests)
  EOF
