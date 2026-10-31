# Backup and restore runbook

## Backup

- Use `pg_dump` or managed PostgreSQL backups.
- Store backups in encrypted, access-controlled storage.
- Recommended frequency: daily full backups plus transaction-log backups where supported.

## Integrity

- Verify backup files with `pg_restore --list` or restore into an isolated database.
- Record backup timestamps and checksums.

## Restore

1. Provision an isolated database.
2. Restore the backup.
3. Run `pnpm db:deploy` if migrations are pending.
4. Start the API and verify `/health/db`.
5. Validate representative project/document data before switching traffic.

## Notes

- Backups must never be public.
- Backup credentials must be protected separately from application secrets.
  EOF
