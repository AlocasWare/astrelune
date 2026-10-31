# M6.4 — Deployment, Backups & Operational Readiness

## Deployment architecture

- Frontend: Vite-built static assets.
- API: Express/Node.js service.
- Database: PostgreSQL via Prisma.
- Health checks: `/health/live`, `/health/db`.

## Production configuration status

- `DATABASE_URL` validated at API startup.
- `ALLOWED_ORIGINS` configures trusted browser origins and CORS.
- Session cookies and CSRF origin validation are implemented.
- Rate limiting is in-memory and suitable for single-instance Release 1.

## Backup and restore

- Backup and restore procedures are documented in `docs/backup-restore.md`.
- No automated backup was executed in this environment; restore remains a documented procedure.

## Monitoring status

- Health endpoints provide basic liveness and database connectivity checks.
- Structured request IDs are included in responses.
- Application logging must avoid manuscript content and secrets.

## Multi-instance readiness

- Sessions are database-backed and can be shared across instances.
- Rate limiting is process-local and would need a shared store for horizontal scaling.
- Reverse proxy must forward client IP and origin headers correctly.

## Operational documentation created

- `docs/production-deployment.md`
- `docs/backup-restore.md`
- `docs/incident-response.md`

## Verification results

- `pnpm lint`: passed
- `pnpm typecheck`: passed
- `pnpm test`: passed (50 API tests, 3 validation tests)
- `pnpm test:integration`: passed (9 PostgreSQL tests)
- `pnpm build`: passed
- `pnpm format:check`: passed
- `pnpm test:e2e`: passed (1 browser test)

## Remaining release risks

- No automated backup or restore was tested in this slice.
- No production deployment was performed.
- Multi-instance rate limiting remains a scaling limitation.
  EOF
