# M13.1 — Hosting Provider Selection Report

**Status:** Complete.
**Report date:** 2026-10-30.

## 1. Existing deployment requirements

- Frontend: React/Vite static build (`apps/web/dist`); browser calls API via `VITE_API_URL`.
- API: Node.js 20.19+ / Express (`apps/api/src/server.js`), default port 4000.
- Database: PostgreSQL 16 via Prisma 6.19.3; `DATABASE_URL` required at startup.
- Migrations: `pnpm db:deploy`.
- Sessions: database-backed, shareable across instances.
- Security: Argon2id, SHA-256 session token hashes, HTTP-only cookies, origin/CSRF validation.
- Cookies: `secure` when `NODE_ENV=production`; `sameSite=lax`.
- CORS/CSRF: `ALLOWED_ORIGINS`.
- Rate limiting: in-memory, process-local; single instance only.
- Health checks: `/health/live`, `/health/db`.
- Backups: `pg_dump`/managed Postgres, encrypted storage, isolated restore, forward-only migrations.
- Secrets: environment variables only.
- Logs: request IDs, health checks, DB metrics.
- Proxy: no `trust proxy` today; review client IP handling.
- Coupling: frontend built with hosted API URL; API allows frontend origin.

## 2. Compared hosting approaches

All cost figures are estimates for a small staging environment: one always-on API instance, one small managed PostgreSQL database, one static frontend, one region, low traffic, no high availability/read replicas, and no custom domain unless noted. Prices come from provider documentation and dated third-party comparisons; verify before provisioning.

### Approach A — Render (recommended)

- Frontend: Render Static Sites (Vite builds, CDN, free static hosting).
- API: Render Web Service (Node.js, health checks, logs, rollback).
- Postgres: Render Postgres (PITR and logical exports on paid plans).
- Backups: managed PITR plus optional scheduled `pg_dump` exports.
- Secrets: per-service environment variables; sensitive values marked secret.
- Deploy/rollback: Git-based or manual deploy; pre-deploy can run `pnpm db:deploy`; instant app rollback.
- Sessions: fully compatible with database-backed sessions.
- Rate limiting: keep one instance; do not scale until shared store exists.
- Complexity: low.
- Cost: about $13/month (Hobby $0, free static site, $7 512 MB web service, Postgres from about $6).
- Limits/lock-in: single-seat Hobby, limited log retention, free services sleep/expire, Render-specific config.

Sources: Render pricing page (2026-10-30) and Pethost comparison dated 26 Sep 2026, updated 25 Oct 2026.

### Approach B — Railway

- Frontend: deployed as a service; no comparable always-free static tier.
- API: service-based Node.js with GitHub integration, variables, logs, health checks, scaling.
- Postgres: usage-billed PostgreSQL service; HA available as upgrade.
- Backups: native backups and PITR documented; validation still required.
- Secrets: project/service variables.
- Deploy/rollback: Git-based deploys and redeployment of previous images; migrations as pre-deploy step.
- Sessions: fully compatible.
- Rate limiting: keep one instance; scaling requires shared limiter.
- Complexity: low to moderate.
- Cost: about $10-25/month; third-party comparison reports about $23.15/month for three 512 MB apps, worker, Postgres, 10 GB traffic.
- Limits/lock-in: no long-term free tier after trial credits, variable usage billing, Railway-specific config.

Sources: Railway pricing docs (2026-10-30) and Pethost comparison dated 26 Sep 2026, updated 25 Oct 2026.

### Approach C — Fly.io

- Frontend: static assets from a Fly Machine or another static host.
- API: Fly Machines, billed by the second, with regions, private networking, autoscaling, health checks.
- Postgres: Fly Managed Postgres with HA, automated backups, pooling, encryption.
- Backups: managed backups and recovery; major upgrades require dump/restore.
- Secrets: Fly secrets injected as environment variables.
- Deploy/rollback: `fly deploy` rolling updates; previous releases redeployable; migrations separate.
- Sessions: fully compatible.
- Rate limiting: keep one Machine initially; multi-instance requires shared store.
- Complexity: moderate.
- Cost: about $42+/month ($4.39 for 512 MB Machine + $38 Managed Postgres Basic, plus storage/egress).
- Limits/lock-in: no free tier, higher managed Postgres cost, Fly-specific config, no in-place major upgrades.

Sources: Fly.io pricing page (2026-10-30) and Fly.io Managed Postgres documentation.

### Other options considered

AWS, Google Cloud, Azure, Heroku, and Vercel/Neon-style combinations can be credible but add operational complexity or split the frontend/API/database across services for a small staging environment. They remain future alternatives if Render limits become unacceptable.

## 3. Recommended architecture

Recommendation: Render Hobby workspace with a Render Static Site, a single Render Web Service for the API, and a paid Render Postgres database.

Why it fits:

- Preserves modular monolith: one frontend, one API, one database.
- Matches existing deployment docs and requires no application architecture change.
- Provides TLS, health checks, logs, managed Postgres backups/PITR, and app rollback.
- Lowest cost among compared options for persistent staging.

Required services:

1. Render Workspace (Hobby initially; Pro if team features needed).
2. Render Static Site for `apps/web` with `VITE_API_URL` set.
3. Render Web Service for API with `NODE_ENV=production`, `DATABASE_URL`, `ALLOWED_ORIGINS`, optional tuning vars.
4. Render Postgres paid instance in same region as API.
5. Optional scheduled backup/export job if needed.

The API can remain single-instance initially, consistent with the in-memory rate limiter and Release 1 scope. Do not enable autoscaling or multiple instances until a shared rate-limit store exists.

Before horizontal scaling:

- Replace/augment in-memory rate limiter with shared store (Redis/Key Value or DB-backed counters).
- Configure Express `trust proxy` if platform terminates TLS or forwards client IPs.
- Verify cookie `Secure`, `SameSite`, and `HttpOnly` under HTTPS.
- Re-run security and rate-limiting validation after changes.

Backups and recovery:

- Use Render Postgres PITR and on-demand logical exports.
- Validate restore into isolated database and run `/health/db`.
- Keep `pg_dump` backups for portability and independent restore testing.
- Store manual exports in encrypted, access-controlled storage with separately protected credentials.
- Treat migrations as forward-only; roll back app first, restore DB only if needed.

Deployment and rollback:

1. Connect repository to Render.
2. Configure static site build command and publish directory.
3. Configure API build command to install deps and generate Prisma client.
4. Configure API pre-deploy command to run `pnpm db:deploy`.
5. Set env vars in Render.
6. Set API health check path to `/health/db`.
7. Deploy and verify health, auth, and representative data read.
8. On failure, roll back app deploy; restore DB from PITR/tested backup only if required.

## 4. Access prerequisites

Hosting organization/project ownership:

- Render organization/account owner.
- Permission to create/manage workspaces, projects, services, databases, environments.
- Decision on Hobby vs Pro workspace (seats, log retention, support, compliance).

Billing permissions:

- Billing administrator access.
- Payment method on file.
- Approval for estimated staging cost and overage (bandwidth, build minutes, DB storage).

Database administration:

- Permission to create/manage Render Postgres instances.
- Ability to view connection strings and rotate DB credentials.
- Approval for region, size, backup/PITR settings, storage autoscaling.

Secret management:

- Permission to create/update service environment variables.
- Process for marking sensitive values as secrets.
- Ownership for secret rotation and incident response.

Deployment access:

- Repository access for Render (or approved image pipeline).
- Permission to configure build, pre-deploy, health checks, rollback.
- Approval for deployment triggers (manual vs auto on push).

Backup storage access:

- Access to Render database recovery features.
- If external exports: access to encrypted object storage, separately stored backup credentials, restore-test schedule.

DNS/domain (if needed):

- DNS provider access for custom domain.
- Ability to create/verify TLS certificates/custom domains.
- Render-provided domains may suffice for initial staging.

## 5. Security and operational considerations

- Set `NODE_ENV=production` so session cookies use `secure`.
- Keep `ALLOWED_ORIGINS` limited to exact hosted frontend origin(s).
- Keep API at one instance until shared rate limiting exists.
- Configure proxy/TLS termination correctly and review `req.ip`.
- Restrict DB network access; use Render internal connection string for API-to-DB.
- Rotate secrets after suspected exposure.
- Verify log retention and export logs if longer retention/centralized monitoring needed.
- Confirm backup restore procedures before relying on staging data.

## 6. Unresolved decisions and blockers

- Provider approval: Render recommended, final selection requires owner approval.
- Workspace tier: Hobby vs Pro (seats, log retention, support).
- Staging DB size: smallest paid instance vs larger for realistic testing.
- Free vs paid staging DB: free Render Postgres expires after 30 days; paid recommended.
- External backup storage: decide if Render PITR plus logical exports are sufficient.
- Cookie hardening: confirm `Secure`, `SameSite`, `HttpOnly` in hosted HTTPS environment.
- Trust proxy: determine whether small code/config change needed for correct client IP handling.
- Region selection: choose closest to primary user base and data requirements.
- Custom domain: decide whether staging uses Render domains or custom domain.

## 7. Cost assumptions

- Costs are estimates, not quotes; verify before provisioning.
- Small staging means one 512 MB API instance, one small managed Postgres instance, one static frontend, one region, low traffic.
- No HA, read replicas, multiple instances, or custom domain costs included unless noted.
- Taxes, build minutes, bandwidth overage, storage growth, support plans excluded.
- Source dates: Render pricing page observed 2026-10-30; Pethost comparison dated 26 Sep 2026 and updated 25 Oct 2026; Railway pricing docs observed 2026-10-30; Fly.io pricing page observed 2026-10-30.

## Recommendation

Use Render for Release 1 staging: a free static site for the React/Vite frontend, one paid 512 MB web service for the Express API, and one paid Render Postgres database in the same region. Keep the API single-instance, use Render Postgres PITR plus optional `pg_dump` exports for backups, and do not enable horizontal scaling until shared rate limiting and proxy-aware client IP handling are implemented.

Decisions requiring approval: final provider selection, Hobby vs Pro workspace, staging database size, external backup storage, custom domain usage, and acceptance of the single-instance rate-limiting limitation for Release 1 staging.
