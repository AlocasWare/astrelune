# Staging environment

## Required variables

- `DATABASE_URL`
- `ALLOWED_ORIGINS`
- Optional: `API_PORT`, `ASTRELUNE_PASSWORD_*`

## Security

- Secrets are provided through environment variables, not source control.
- API startup fails if `DATABASE_URL` is missing.
- CORS and origin validation use configured trusted origins.
- Session cookies are HTTP-only; production HTTPS settings must be verified in deployment.

## Local staging simulation

- PostgreSQL: `docker compose up -d postgres` on port 5433.
- API: `DATABASE_URL=... ALLOWED_ORIGINS=... pnpm dev:api`
- Frontend: `pnpm dev:web`
  EOF
