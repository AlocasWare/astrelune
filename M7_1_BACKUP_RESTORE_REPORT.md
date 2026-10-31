# M7.1 — Backup & Restore Validation

## Backup method

- PostgreSQL `pg_dump` custom format from the `astrelune-postgres-1` container.
- Command: `docker exec astrelune-postgres-1 pg_dump -U astrelune -d astrelune --format=custom`
- Artifact: `/tmp/astrelune-backup/astrelune.dump` (151,761 bytes, PostgreSQL custom dump v1.15-0).

## Restore environment

- Isolated database `astrelune_restore_test` in the same PostgreSQL container.
- No source database was overwritten.

## Restore procedure

- `DROP DATABASE IF EXISTS astrelune_restore_test;`
- `CREATE DATABASE astrelune_restore_test;`
- `pg_restore -U astrelune -d astrelune_restore_test --clean --if-exists < astrelune.dump`

## Integrity and application verification

- Restore completed successfully.
- Restored table counts: 14 users, 0 projects, 0 documents, 0 worlds, 0 writing goals, 0 writing activity, 0 preferences.
- API health check against restored database: `{"status":"ok","database":"ok"}`.

## Recovery limitations

- The source database contained no business records at backup time; verification is limited to schema and connectivity.
- Restore testing used an isolated database in the same PostgreSQL instance.
- Automated backup scheduling and remote encrypted storage remain future operational work.

## Final assessment

Backup creation and isolated restore succeeded. The application can start and pass its database health check against the restored database.
EOF
