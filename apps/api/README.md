# API lifecycle services

This workspace has no existing account/session server, so the deletion router is an Express router factory. Mount it only after JSON parsing and supply the application's real authentication middleware. That middleware must set `req.authenticatedPrincipal`; the service's `authenticate(principal)` callback must verify that principal against the live authenticated session and return `{ userId }`.

```js
const express = require("express");
const { PrismaClient } = require("./src/generated/prisma");
const { createLifecycleServices } = require("./src/services/resource-lifecycle");
const { createApiApp } = require("./src/app");

const prisma = new PrismaClient();
const lifecycle = createLifecycleServices({ prisma, authenticate, verifyRecentAuthentication });
const app = createApiApp({ express, services: lifecycle, authenticateRequest });
```

All mounted endpoints use the `/api/v1` prefix. The account endpoint requires `{"confirmation":"DELETE MY ACCOUNT","password":"..."}`; a recent authenticated session may satisfy the verifier without a password. `verifyRecentAuthentication` must validate any password against the same user and enforce the configured recent-authentication window. Project, document, and world deletion require their exact confirmation strings. The router returns `204` for successful deletion and stable JSON error envelopes with a request ID; missing and foreign-owned resources both return `404`.

`PUT /api/v1/documents/:documentId/content` requires `contentVersion`, `contentSchemaVersion`, and `content`, plus an `Idempotency-Key` header. The service uses an atomic version-conditional update inside the save transaction. It returns `{ document: { id, contentVersion, contentSchemaVersion, wordCount, updatedAt }, saveStatus: "saved" }`; stale writes return `409 DOCUMENT_VERSION_CONFLICT`. Clients should retain their local draft on that response. `GET /api/v1/documents/:documentId/content` reloads the authorized server copy.

Deletion services make the database changes and metadata-only `OperationalEvent` row in one transaction. Operational events contain IDs and operation names only; they never include manuscript or worldbuilding content. Documents and world entries are deleted leaf-first to satisfy their restrictive self-relations. Activity rows are preserved for project/document deletion through `SET NULL` references and removed for account deletion.

`DELETE /api/v1/documents/:documentId` permanently deletes that document and its full descendant subtree. `DELETE /api/v1/worlds/:worldId` deletes the world's entries and relationships, while linked projects and manuscript documents remain. Project and world links are removed as part of their respective parent deletion.

Shared request and editor schemas live in `packages/validation`; from the repository root, run `pnpm build:validation` after changing them. Rich text accepts only the initial TipTap/ProseMirror subset: paragraphs, headings, bold/italic, lists, blockquotes, horizontal rules, and safe links. It rejects unknown node/mark attributes, embeds, HTML, executable URLs, oversized payloads, and excessive nesting. The API derives `plainText` and `wordCount` from parsed content. Folders must have `content = NULL`; both the database check constraint and document service enforce this.

Set `DATABASE_URL` to a disposable PostgreSQL database. From the repository root, run `pnpm test:validation` for schema tests and `pnpm test:integration` for deletion, restore, idempotency, cycle, authorization-boundary, version-conflict, and HTTP response behavior.
