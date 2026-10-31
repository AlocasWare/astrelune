# M10.4 — Operational and Deployment Acceptance

## Documented

- Deployment architecture.
- Environment configuration.
- Health checks.
- Backup and restore procedures.
- Incident response and rollback.

## Demonstrated

- Local API startup and health checks.
- Database restore into an isolated database.
- Application health check against restored database.
- Local staging simulation and rollback rehearsal.

## Not demonstrated

- Production deployment.
- Automated backup creation and restore.
- Multi-instance behavior.
- Production monitoring.

## Known single-instance limitations

- In-memory rate limiting.
- No shared session state beyond database-backed sessions.
  EOF
