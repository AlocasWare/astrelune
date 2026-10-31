# Deployment guide

## Architecture

- Frontend: static Vite build served by a static host or reverse proxy.
- API: Node.js/Express service.
- Database: PostgreSQL.
- Health endpoints: `/health/live`, `/health/db`.

## Deployment steps

1. Set required environment variables.
2. Install dependencies.
3. Generate Prisma client.
4. Apply migrations.
5. Build frontend.
6. Start API and frontend.
7. Verify health endpoints and authentication.

## Rollback

- Revert application artifact to the previous known-good version.
- Restart services.
- Verify health and data integrity.
- Treat database migrations separately from application rollback.
  EOF
