# M7.2 — Production-Like Staging Deployment & Rollback

## Staging architecture

- Frontend: Vite static build.
- API: Node.js/Express on port 4013 for local staging simulation.
- Database: PostgreSQL container on port 5433.
- Health endpoints: `/health/live`, `/health/db`.

## Staging configuration

- `DATABASE_URL` validated at startup.
- `ALLOWED_ORIGINS` configured for the frontend origin.
- Secrets provided through environment variables.

## Deployment outcome

- API started successfully.
- Database health check returned `{"status":"ok","database":"ok"}`.

## Persistence verification

- API restart completed successfully.
- Database health check passed after restart.
- No data migration was performed during the rehearsal.

## Rollback outcome

- Application process was stopped and restarted.
- Health check passed after restart.
- Database remained intact.

## Security observations

- No secrets are committed.
- CORS and origin validation use configured trusted origins.
- Cookie hardening and multi-instance behavior remain documented limitations.

## Known limitations

- This was a local staging simulation, not a cloud deployment.
- No production deployment was performed.
- Multi-instance rate limiting remains process-local.
- Automated backup scheduling remains future work.

## Verification results

- `pnpm lint`: passed
- `pnpm typecheck`: passed
- `pnpm test`: passed (50 API tests, 3 validation tests)
- `pnpm test:integration`: passed (9 PostgreSQL tests)
- `pnpm build`: passed
- `pnpm format:check`: passed
- `pnpm test:e2e`: passed (1 browser test)
  EOF
