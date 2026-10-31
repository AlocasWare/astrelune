# Astrelune · Release 1 foundation

Astrelune is a pnpm workspace with a React/Vite frontend, Express API, shared TypeScript validation package, and PostgreSQL/Prisma data layer.
The frontend is prepared for Tailwind CSS utility classes while retaining the existing stylesheet reset and component styles.

## Local setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` for a PostgreSQL database.
2. Start local PostgreSQL with `docker compose up -d postgres`, or use your existing PostgreSQL server.
3. Use Node.js 20.19 or newer. Enable Corepack and install dependencies with `corepack enable && pnpm install`.
4. Generate Prisma Client and apply the checked-in migrations with `pnpm db:generate` and `pnpm db:deploy`.
5. Start the API and frontend with `pnpm dev`.

The API listens on port 4000 and the frontend on port 5174 by default. Check the API and database endpoints with:

```sh
curl --fail http://localhost:4000/health/live
curl --fail http://localhost:4000/health/db
```

### Optional Docker Node workflow

If you prefer not to install Node.js and pnpm on the host, use Docker Desktop and run these commands from the repository root. Start the PostgreSQL service first with `docker compose up -d postgres`; it is published on port 5433.

Install dependencies, generate Prisma Client, and deploy migrations:

```sh
docker run --rm -v "$PWD:/workspace" -w /workspace \
  -e DATABASE_URL='postgresql://astrelune:astrelune@host.docker.internal:5433/astrelune?schema=public' \
  node:20 sh -lc 'corepack enable && corepack prepare pnpm@10.18.1 --activate && pnpm install --frozen-lockfile && pnpm db:generate && pnpm db:deploy'
```

Run both development servers with:

```sh
docker run --rm -it -p 5174:5174 -p 4000:4000 \
  -v "$PWD:/workspace" -w /workspace \
  -e DATABASE_URL='postgresql://astrelune:astrelune@host.docker.internal:5433/astrelune?schema=public' \
  node:20 sh -lc 'corepack enable && corepack prepare pnpm@10.18.1 --activate && pnpm dev'
```

From the host, `GET /health/live` checks that the API process is responding, and `GET /health/db` runs a database query and returns HTTP 503 when PostgreSQL is unavailable. `pnpm db:health` performs the same database query from the command line.

Authentication and the writing editor are intentionally outside this foundation milestone. Existing lifecycle routes remain in place, but the starter server does not authenticate requests.

## Workspace checks

- `pnpm build` builds shared validation and the frontend.
- `pnpm typecheck` typechecks the frontend and builds shared validation.
- `pnpm lint` checks JavaScript and TypeScript with ESLint.
- `pnpm format:check` checks formatting; `pnpm format` applies Prettier formatting.
- `pnpm test` runs API and shared validation tests without PostgreSQL.
- `pnpm test:api` runs API health endpoint tests without requiring PostgreSQL.
- `pnpm test:validation` runs shared input/editor validation tests.
- `DATABASE_URL=... pnpm test:integration` runs PostgreSQL lifecycle integration tests. Use a disposable database; the tests create and delete test records.
- `pnpm exec prisma validate` validates the Prisma schema.

### Database migration note

The migration `20261027040000_remove_accidental_new_model15` removes the placeholder
`NewModel15` table. Before deploying it to an existing database, take a backup and
confirm the table contains no data that needs to be retained. Historical migrations
are intentionally left unchanged; the removal is represented by a new forward-only
migration.
