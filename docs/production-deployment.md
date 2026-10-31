# Production deployment guide

## Environment variables

- `DATABASE_URL` (required): PostgreSQL connection string.
- `ALLOWED_ORIGINS`: comma-separated trusted browser origins.
- `API_PORT`: optional API port, default 4000.
- `ASTRELUNE_PASSWORD_*`: optional Argon2 tuning values.

## Startup validation

The API exits immediately if `DATABASE_URL` is missing.

## Health checks

- `GET /health/live` returns process liveness.
- `GET /health/db` verifies database connectivity.

## Deployment steps

1. Install dependencies.
2. Run `pnpm db:generate`.
3. Run `pnpm db:deploy`.
4. Start API and web services.
5. Verify health endpoints.

## Rollback

- Revert application deployment to previous release.
- Restore database from tested backup if schema/data rollback is required.
- Rotate sessions after security incidents.
  EOF
