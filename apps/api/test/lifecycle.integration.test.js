const assert = require("node:assert/strict");
const { after, describe, it } = require("node:test");
const express = require("express");
const { PrismaClient } = require("../src/generated/prisma");
const { createApiApp } = require("../src/app");
const {
  ACCOUNT_DELETE_CONFIRMATION,
  LifecycleError,
  createLifecycleServices,
} = require("../src/services/resource-lifecycle");

const enabled = Boolean(process.env.DATABASE_URL);
const prisma = enabled ? new PrismaClient() : null;
const services = enabled
  ? createLifecycleServices({
      prisma,
      authenticate: async (principal) => (principal?.userId ? { userId: principal.userId } : null),
      verifyRecentAuthentication: async (_principal, proof) => proof === "recent-auth-proof",
    })
  : null;

after(async () => {
  if (prisma) await prisma.$disconnect();
});

async function createOwner(label) {
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const user = await prisma.user.create({
    data: {
      email: `${label}-${nonce}@integration.invalid`,
      passwordHash: "test-hash",
      displayName: label,
    },
  });
  return { user, principal: { userId: user.id } };
}

async function cleanupOwner(owner) {
  if (!owner) return;
  try {
    await services.deleteUserAccount(owner.principal, {
      confirmation: ACCOUNT_DELETE_CONFIRMATION,
      reauthenticationProof: "recent-auth-proof",
    });
  } catch (error) {
    if (!(error instanceof LifecycleError) || error.code !== "NOT_FOUND") throw error;
  }
}

async function createProject(owner, suffix = "project") {
  return prisma.project.create({ data: { ownerId: owner.user.id, title: suffix } });
}

async function createWorld(owner, suffix = "world") {
  return prisma.world.create({ data: { ownerId: owner.user.id, name: suffix } });
}

function servicesWithOperationalEventFailure() {
  return createLifecycleServices({
    prisma: {
      $transaction: (operation, options) =>
        prisma.$transaction(
          (tx) =>
            operation(
              new Proxy(tx, {
                get(target, property, receiver) {
                  if (property === "operationalEvent")
                    return {
                      create: async () => {
                        throw new Error("simulated outbox failure");
                      },
                    };
                  return Reflect.get(target, property, receiver);
                },
              }),
            ),
          options,
        ),
    },
    authenticate: async (principal) => ({ userId: principal.userId }),
    verifyRecentAuthentication: async () => true,
  });
}

const editorDoc = (text) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

describe("lifecycle services (PostgreSQL integration)", { skip: !enabled }, () => {
  it("installs the declared foreign-key delete actions", async () => {
    const rows = await prisma.$queryRaw`
      SELECT child.relname AS table_name,
             string_agg(child_column.attname, ',' ORDER BY key_column.ordinality) AS columns,
             constraint_row.confdeltype AS delete_action
      FROM pg_constraint AS constraint_row
      JOIN pg_class AS child ON child.oid = constraint_row.conrelid
      JOIN pg_namespace AS schema_row ON schema_row.oid = child.relnamespace
      JOIN unnest(constraint_row.conkey) WITH ORDINALITY AS key_column(attnum, ordinality) ON true
      JOIN pg_attribute AS child_column ON child_column.attrelid = child.oid AND child_column.attnum = key_column.attnum
      WHERE constraint_row.contype = 'f' AND schema_row.nspname = current_schema()
      GROUP BY child.relname, constraint_row.oid, constraint_row.confdeltype
    `;
    const actions = new Map(
      rows.map((row) => [`${row.table_name}:${row.columns}`, row.delete_action]),
    );
    for (const [relation, action] of [
      ["Project:ownerId", "r"],
      ["World:ownerId", "r"],
      ["Document:projectId", "c"],
      ["Document:parentId", "r"],
      ["DocumentRevision:documentId", "c"],
      ["DocumentRevision:createdById", "n"],
      ["WritingActivity:userId", "c"],
      ["WritingActivity:projectId", "n"],
      ["WritingActivity:documentId", "n"],
      ["WritingGoal:userId", "c"],
      ["WritingGoal:projectId", "c"],
      ["ProjectWorld:projectId", "c"],
      ["ProjectWorld:worldId", "c"],
      ["WorldEntry:worldId", "c"],
      ["WorldEntry:parentId", "r"],
      ["WorldEntryRelationship:sourceEntryId", "c"],
      ["WorldEntryRelationship:targetEntryId", "c"],
      ["DocumentWorldEntry:documentId", "c"],
      ["DocumentWorldEntry:worldEntryId", "c"],
    ])
      assert.equal(actions.get(relation), action, relation);
  });

  it("permanently deletes document subtrees while retaining activity and the project", async () => {
    const owner = await createOwner("document-delete");
    try {
      const project = await createProject(owner);
      const world = await createWorld(owner);
      const entry = await prisma.worldEntry.create({
        data: {
          worldId: world.id,
          name: "entry",
          kind: "CHARACTER",
          content: editorDoc("profile"),
        },
      });
      const root = await prisma.document.create({
        data: { projectId: project.id, title: "root", kind: "FOLDER" },
      });
      const child = await prisma.document.create({
        data: {
          projectId: project.id,
          parentId: root.id,
          title: "child",
          kind: "CHAPTER",
          content: editorDoc("chapter"),
        },
      });
      const leaf = await prisma.document.create({
        data: {
          projectId: project.id,
          parentId: child.id,
          title: "leaf",
          kind: "SCENE",
          content: editorDoc("scene"),
        },
      });
      await prisma.documentRevision.create({
        data: {
          documentId: child.id,
          revisionNumber: 1,
          content: editorDoc("chapter"),
          plainText: "chapter",
          wordCount: 1,
          createdById: owner.user.id,
          reason: "MANUAL_CHECKPOINT",
        },
      });
      await prisma.documentWorldEntry.create({
        data: { documentId: child.id, worldEntryId: entry.id },
      });
      const activity = await prisma.writingActivity.create({
        data: {
          userId: owner.user.id,
          projectId: project.id,
          documentId: leaf.id,
          idempotencyKey: "old-writing",
          activityDate: new Date("2026-10-26T00:00:00Z"),
          wordsAdded: 8,
        },
      });

      await services.deleteDocumentSubtree(owner.principal, child.id);

      assert.equal(await prisma.document.count({ where: { id: { in: [child.id, leaf.id] } } }), 0);
      assert.equal(await prisma.document.count({ where: { id: root.id } }), 1);
      assert.equal(await prisma.documentRevision.count({ where: { documentId: child.id } }), 0);
      assert.equal(await prisma.documentWorldEntry.count({ where: { documentId: child.id } }), 0);
      assert.deepEqual(
        await prisma.writingActivity.findUnique({
          where: { id: activity.id },
          select: { projectId: true, documentId: true },
        }),
        { projectId: project.id, documentId: null },
      );
      assert.equal(await prisma.project.count({ where: { id: project.id } }), 1);
      assert.equal(await prisma.world.count({ where: { id: world.id } }), 1);
    } finally {
      await cleanupOwner(owner);
    }
  });

  it("deletes projects and document trees while nulling activity references and retaining linked worlds", async () => {
    const owner = await createOwner("project-delete");
    try {
      const project = await createProject(owner);
      const world = await createWorld(owner);
      await services.linkWorldToProject(owner.principal, project.id, world.id);
      await prisma.writingGoal.create({
        data: {
          userId: owner.user.id,
          projectId: project.id,
          period: "DAILY",
          targetWords: 500,
          startsAt: new Date("2026-10-26T00:00:00Z"),
        },
      });
      const doc = await prisma.document.create({
        data: { projectId: project.id, title: "chapter", kind: "CHAPTER" },
      });
      const entry = await prisma.worldEntry.create({
        data: {
          worldId: world.id,
          name: "entry",
          kind: "CHARACTER",
          content: editorDoc("profile"),
        },
      });
      await prisma.documentWorldEntry.create({
        data: { documentId: doc.id, worldEntryId: entry.id },
      });
      await prisma.documentRevision.create({
        data: {
          documentId: doc.id,
          revisionNumber: 1,
          content: editorDoc("chapter"),
          plainText: "chapter",
          wordCount: 1,
          createdById: owner.user.id,
          reason: "MANUAL_CHECKPOINT",
        },
      });
      const activity = await prisma.writingActivity.create({
        data: {
          userId: owner.user.id,
          projectId: project.id,
          documentId: doc.id,
          idempotencyKey: "project-writing",
          activityDate: new Date("2026-10-26T00:00:00Z"),
          wordsAdded: 20,
        },
      });

      await assert.rejects(
        () => servicesWithOperationalEventFailure().deleteProject(owner.principal, project.id),
        /simulated outbox failure/u,
      );
      assert.equal(await prisma.project.count({ where: { id: project.id } }), 1);
      assert.equal(await prisma.document.count({ where: { id: doc.id } }), 1);
      assert.deepEqual(
        await prisma.writingActivity.findUnique({
          where: { id: activity.id },
          select: { projectId: true, documentId: true },
        }),
        { projectId: project.id, documentId: doc.id },
      );

      await services.deleteProject(owner.principal, project.id);

      assert.equal(await prisma.project.count({ where: { id: project.id } }), 0);
      assert.equal(await prisma.document.count({ where: { id: doc.id } }), 0);
      assert.equal(await prisma.documentRevision.count({ where: { documentId: doc.id } }), 0);
      assert.equal(await prisma.documentWorldEntry.count({ where: { documentId: doc.id } }), 0);
      assert.equal(await prisma.writingGoal.count({ where: { projectId: project.id } }), 0);
      assert.equal(await prisma.projectWorld.count({ where: { projectId: project.id } }), 0);
      assert.deepEqual(
        await prisma.writingActivity.findUnique({
          where: { id: activity.id },
          select: { projectId: true, documentId: true },
        }),
        { projectId: null, documentId: null },
      );
      assert.equal(await prisma.world.count({ where: { id: world.id } }), 1);
      await assert.rejects(() => services.deleteProject(owner.principal, project.id), {
        code: "NOT_FOUND",
        status: 404,
      });
    } finally {
      await cleanupOwner(owner);
    }
  });

  it("deletes world-entry trees without deleting linked projects or documents", async () => {
    const owner = await createOwner("world-delete");
    try {
      const project = await createProject(owner);
      const world = await createWorld(owner);
      const otherWorld = await createWorld(owner, "other-world");
      await services.linkWorldToProject(owner.principal, project.id, world.id);
      const doc = await prisma.document.create({
        data: { projectId: project.id, title: "chapter", kind: "CHAPTER" },
      });
      const root = await prisma.worldEntry.create({
        data: { worldId: world.id, name: "root", kind: "CHARACTER", content: editorDoc("root") },
      });
      const child = await prisma.worldEntry.create({
        data: {
          worldId: world.id,
          parentId: root.id,
          name: "child",
          kind: "CONCEPT",
          content: editorDoc("child"),
        },
      });
      const otherRoot = await prisma.worldEntry.create({
        data: {
          worldId: otherWorld.id,
          name: "other",
          kind: "OBJECT",
          content: editorDoc("other"),
        },
      });
      await services.linkWorldEntries(owner.principal, root.id, child.id, "KNOWS");
      await services.linkDocumentToWorldEntry(owner.principal, doc.id, child.id);
      await assert.rejects(
        () =>
          services.createWorldEntry(owner.principal, otherWorld.id, {
            parentId: root.id,
            name: "invalid child",
            kind: "OBJECT",
            content: editorDoc("invalid"),
          }),
        { code: "NOT_FOUND", status: 404 },
      );
      await assert.rejects(
        () => services.linkWorldEntries(owner.principal, root.id, otherRoot.id, "CROSSES_WORLD"),
        { code: "NOT_FOUND", status: 404 },
      );

      await services.deleteWorld(owner.principal, world.id);

      assert.equal(await prisma.worldEntry.count({ where: { worldId: world.id } }), 0);
      assert.equal(
        await prisma.worldEntryRelationship.count({ where: { sourceEntryId: root.id } }),
        0,
      );
      assert.equal(await prisma.documentWorldEntry.count({ where: { documentId: doc.id } }), 0);
      assert.equal(
        await prisma.projectWorld.count({ where: { projectId: project.id, worldId: world.id } }),
        0,
      );
      assert.equal(await prisma.project.count({ where: { id: project.id } }), 1);
      assert.equal(await prisma.document.count({ where: { id: doc.id } }), 1);
    } finally {
      await cleanupOwner(owner);
    }
  });

  it("requires explicit confirmation and recent authentication, then permanently erases the account data", async () => {
    const owner = await createOwner("account-delete");
    try {
      const project = await createProject(owner);
      const world = await createWorld(owner);
      await prisma.userPreferences.create({ data: { userId: owner.user.id } });
      await prisma.session.create({
        data: {
          userId: owner.user.id,
          tokenHash: `session-${owner.user.id}`,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      const document = await prisma.document.create({
        data: {
          projectId: project.id,
          title: "private",
          kind: "CHAPTER",
          content: editorDoc("private manuscript"),
        },
      });
      const worldEntry = await prisma.worldEntry.create({
        data: {
          worldId: world.id,
          name: "private entry",
          kind: "CHARACTER",
          content: editorDoc("private world"),
        },
      });
      await prisma.documentRevision.create({
        data: {
          documentId: document.id,
          revisionNumber: 1,
          content: editorDoc("private manuscript"),
          plainText: "private manuscript",
          wordCount: 2,
          createdById: owner.user.id,
          reason: "MANUAL_CHECKPOINT",
        },
      });
      await prisma.writingGoal.create({
        data: {
          userId: owner.user.id,
          period: "DAILY",
          targetWords: 100,
          startsAt: new Date("2026-10-26T00:00:00Z"),
        },
      });
      await prisma.writingActivity.create({
        data: {
          userId: owner.user.id,
          projectId: project.id,
          idempotencyKey: "account-writing",
          activityDate: new Date("2026-10-26T00:00:00Z"),
          wordsAdded: 2,
        },
      });

      await assert.rejects(
        () =>
          services.deleteUserAccount(owner.principal, {
            confirmation: "yes",
            reauthenticationProof: "recent-auth-proof",
          }),
        { code: "CONFIRMATION_REQUIRED" },
      );
      await assert.rejects(
        () =>
          services.deleteUserAccount(owner.principal, {
            confirmation: ACCOUNT_DELETE_CONFIRMATION,
            reauthenticationProof: "stale",
          }),
        { code: "RECENT_AUTHENTICATION_REQUIRED" },
      );
      assert.equal(await prisma.user.count({ where: { id: owner.user.id } }), 1);

      await services.deleteUserAccount(owner.principal, {
        confirmation: ACCOUNT_DELETE_CONFIRMATION,
        reauthenticationProof: "recent-auth-proof",
      });

      assert.equal(await prisma.user.count({ where: { id: owner.user.id } }), 0);
      assert.equal(await prisma.project.count({ where: { id: project.id } }), 0);
      assert.equal(await prisma.world.count({ where: { id: world.id } }), 0);
      assert.equal(await prisma.document.count({ where: { projectId: project.id } }), 0);
      assert.equal(await prisma.documentRevision.count({ where: { documentId: document.id } }), 0);
      assert.equal(await prisma.worldEntry.count({ where: { id: worldEntry.id } }), 0);
      assert.equal(await prisma.session.count({ where: { userId: owner.user.id } }), 0);
      assert.equal(await prisma.userPreferences.count({ where: { userId: owner.user.id } }), 0);
      assert.equal(await prisma.writingGoal.count({ where: { userId: owner.user.id } }), 0);
      assert.equal(await prisma.writingActivity.count({ where: { userId: owner.user.id } }), 0);
      assert.equal(
        await prisma.operationalEvent.count({
          where: { eventType: "ACCOUNT_DELETED", resourceId: owner.user.id },
        }),
        1,
      );
      owner.user = null;
    } finally {
      if (owner.user) await cleanupOwner(owner);
    }
  });

  it("saves revisions transactionally and idempotently, restores by adding a revision, and blocks tree cycles", async () => {
    const owner = await createOwner("revision-save");
    try {
      const project = await createProject(owner);
      const folder = await prisma.document.create({
        data: { projectId: project.id, title: "folder", kind: "FOLDER" },
      });
      await assert.rejects(
        () =>
          prisma.document.create({
            data: {
              projectId: project.id,
              title: "invalid folder",
              kind: "FOLDER",
              content: editorDoc("blocked by database"),
            },
          }),
        (error) => error.message.includes("Document_folder_content_null"),
      );
      const doc = await prisma.document.create({
        data: { projectId: project.id, parentId: folder.id, title: "chapter", kind: "CHAPTER" },
      });
      await assert.rejects(
        () =>
          services.saveDocument(
            owner.principal,
            folder.id,
            { contentVersion: 0, contentSchemaVersion: 1, content: editorDoc("bad") },
            "folder-save",
          ),
        { code: "FOLDER_CANNOT_CONTAIN_CONTENT" },
      );

      const first = await services.saveDocument(
        owner.principal,
        doc.id,
        { contentVersion: 0, contentSchemaVersion: 1, content: editorDoc("one two") },
        "save-1",
      );
      const duplicate = await services.saveDocument(
        owner.principal,
        doc.id,
        { contentVersion: 0, contentSchemaVersion: 1, content: editorDoc("one two") },
        "save-1",
      );
      assert.equal(duplicate.idempotent, true);
      assert.equal(duplicate.revisionId, first.revisionId);
      await assert.rejects(
        () =>
          services.saveDocument(
            owner.principal,
            doc.id,
            { contentVersion: 0, contentSchemaVersion: 1, content: editorDoc("different payload") },
            "save-1",
          ),
        { code: "IDEMPOTENCY_KEY_REUSE", status: 409 },
      );

      await assert.rejects(
        () =>
          servicesWithOperationalEventFailure().saveDocument(
            owner.principal,
            doc.id,
            {
              contentVersion: 1,
              contentSchemaVersion: 1,
              content: editorDoc("transaction should roll back"),
            },
            "save-fail",
          ),
        /simulated outbox failure/u,
      );
      assert.equal((await prisma.document.findUnique({ where: { id: doc.id } })).contentVersion, 1);
      assert.equal(await prisma.documentRevision.count({ where: { documentId: doc.id } }), 1);
      assert.equal(await prisma.writingActivity.count({ where: { userId: owner.user.id } }), 1);

      const racingSaves = await Promise.allSettled([
        services.saveDocument(
          owner.principal,
          doc.id,
          { contentVersion: 1, contentSchemaVersion: 1, content: editorDoc("one two three") },
          "save-2",
        ),
        services.saveDocument(
          owner.principal,
          doc.id,
          { contentVersion: 1, contentSchemaVersion: 1, content: editorDoc("one two three four") },
          "save-3",
        ),
      ]);
      const acceptedSaves = racingSaves.filter((result) => result.status === "fulfilled");
      const rejectedSaves = racingSaves.filter((result) => result.status === "rejected");
      assert.equal(acceptedSaves.length, 1);
      assert.equal(rejectedSaves.length, 1);
      assert.equal(rejectedSaves[0].reason.code, "DOCUMENT_VERSION_CONFLICT");
      const latest = await prisma.document.findUnique({
        where: { id: doc.id },
        select: { contentVersion: true },
      });
      const third = await services.saveDocument(
        owner.principal,
        doc.id,
        {
          contentVersion: latest.contentVersion,
          contentSchemaVersion: 1,
          content: editorDoc("one two three four five"),
        },
        "save-4",
      );
      assert.equal(third.revisionNumber, 3);
      assert.equal(await prisma.documentRevision.count({ where: { documentId: doc.id } }), 3);
      assert.equal(await prisma.writingActivity.count({ where: { userId: owner.user.id } }), 3);

      const sourceBefore = await prisma.documentRevision.findUnique({
        where: { id: first.revisionId },
      });
      const restored = await services.restoreDocumentRevision(
        owner.principal,
        doc.id,
        first.revisionId,
        "restore-1",
      );
      const restoredAgain = await services.restoreDocumentRevision(
        owner.principal,
        doc.id,
        first.revisionId,
        "restore-1",
      );
      assert.equal(restored.revisionNumber, 4);
      assert.equal(restoredAgain.idempotent, true);
      assert.equal(await prisma.documentRevision.count({ where: { documentId: doc.id } }), 4);
      assert.deepEqual(
        await prisma.documentRevision.findUnique({ where: { id: first.revisionId } }),
        sourceBefore,
      );
      assert.deepEqual(
        await prisma.document.findUnique({
          where: { id: doc.id },
          select: { content: true, wordCount: true },
        }),
        { content: editorDoc("one two"), wordCount: 2 },
      );

      await assert.rejects(() => services.moveDocument(owner.principal, doc.id, doc.id), {
        code: "DOCUMENT_CYCLE",
      });
      await assert.rejects(() => services.moveDocument(owner.principal, folder.id, doc.id), {
        code: "DOCUMENT_CYCLE",
      });
      const foreignOwner = await createOwner("foreign-owner");
      try {
        const foreignWorld = await createWorld(foreignOwner);
        const foreignEntry = await services.createWorldEntry(
          foreignOwner.principal,
          foreignWorld.id,
          { name: "foreign", kind: "CHARACTER", content: editorDoc("private") },
        );
        await assert.rejects(
          () => services.linkWorldToProject(owner.principal, project.id, foreignWorld.id),
          { code: "NOT_FOUND", status: 404 },
        );
        await assert.rejects(
          () => services.linkDocumentToWorldEntry(owner.principal, doc.id, foreignEntry.id),
          { code: "NOT_FOUND", status: 404 },
        );
      } finally {
        await cleanupOwner(foreignOwner);
      }
    } finally {
      await cleanupOwner(owner);
    }
  });

  it("creates nested documents, saves and reloads content, reports stale versions, conceals foreign access, and deletes with confirmations", async () => {
    const owner = await createOwner("http-delete");
    const foreignOwner = await createOwner("foreign-reader");
    const app = createApiApp({
      express,
      services,
      authenticateRequest: (req, _res, next) => {
        req.authenticatedPrincipal =
          req.get("x-test-actor") === "foreign" ? foreignOwner.principal : owner.principal;
        next();
      },
    });
    const server = app.listen(0);
    try {
      const address = server.address();
      const base = `http://127.0.0.1:${address.port}/api/v1`;
      const created = await fetch(`http://127.0.0.1:${address.port}/api/v1/projects`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "  API project  " }),
      });
      assert.equal(created.status, 201);
      const createdBody = await created.json();
      assert.equal(createdBody.data.project.title, "API project");
      assert.equal(createdBody.data.project.ownerId, owner.user.id);
      const projectId = createdBody.data.project.id;
      const ownerSpoof = await fetch(`${base}/projects`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "spoof", ownerId: "00000000-0000-4000-8000-000000000000" }),
      });
      assert.equal(ownerSpoof.status, 422);
      assert.equal((await ownerSpoof.json()).error.code, "VALIDATION_ERROR");

      const folderResponse = await fetch(`${base}/projects/${projectId}/documents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Folder", kind: "FOLDER" }),
      });
      assert.equal(folderResponse.status, 201);
      const folder = (await folderResponse.json()).data.document;
      const chapterResponse = await fetch(`${base}/projects/${projectId}/documents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Chapter", kind: "CHAPTER", parentId: folder.id }),
      });
      assert.equal(chapterResponse.status, 201);
      const chapter = (await chapterResponse.json()).data.document;
      const sceneResponse = await fetch(`${base}/projects/${projectId}/documents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Scene", kind: "SCENE", parentId: chapter.id }),
      });
      assert.equal(sceneResponse.status, 201);
      const scene = (await sceneResponse.json()).data.document;
      const otherProject = await services.createProject(owner.principal, {
        title: "Other project",
      });
      const otherFolder = await services.createDocument(owner.principal, otherProject.id, {
        title: "Other folder",
        kind: "FOLDER",
      });
      await assert.rejects(() => services.moveDocument(owner.principal, scene.id, otherFolder.id), {
        code: "NOT_FOUND",
        status: 404,
      });
      const content = editorDoc("A quiet evening settled over the garden.");
      const saved = await fetch(`${base}/documents/${scene.id}/content`, {
        method: "PUT",
        headers: { "content-type": "application/json", "Idempotency-Key": "api-save-1" },
        body: JSON.stringify({ contentVersion: 0, contentSchemaVersion: 1, content }),
      });
      assert.equal(saved.status, 200);
      const savedBody = await saved.json();
      assert.equal(savedBody.saveStatus, "saved");
      assert.deepEqual(Object.keys(savedBody.document).sort(), [
        "contentSchemaVersion",
        "contentVersion",
        "id",
        "updatedAt",
        "wordCount",
      ]);
      assert.equal(savedBody.document.id, scene.id);
      assert.equal(savedBody.document.contentVersion, 1);
      assert.equal(savedBody.document.wordCount, 7);
      assert.equal(typeof savedBody.document.updatedAt, "string");

      const reloaded = await fetch(`${base}/documents/${scene.id}/content`).then((response) =>
        response.json(),
      );
      assert.deepEqual(reloaded.document.content, content);
      assert.equal(reloaded.document.contentVersion, 1);
      assert.equal(reloaded.document.wordCount, 7);
      const stale = await fetch(`${base}/documents/${scene.id}/content`, {
        method: "PUT",
        headers: { "content-type": "application/json", "Idempotency-Key": "api-save-stale" },
        body: JSON.stringify({
          contentVersion: 0,
          contentSchemaVersion: 1,
          content: editorDoc("unsaved local draft"),
        }),
      });
      assert.equal(stale.status, 409);
      const staleBody = await stale.json();
      assert.equal(staleBody.error.code, "DOCUMENT_VERSION_CONFLICT");
      assert.match(staleBody.error.requestId, /^[0-9a-f-]{36}$/iu);
      const afterConflict = await fetch(`${base}/documents/${scene.id}/content`).then((response) =>
        response.json(),
      );
      assert.deepEqual(afterConflict.document.content, content);

      const foreignRead = await fetch(`${base}/documents/${scene.id}/content`, {
        headers: { "x-test-actor": "foreign" },
      });
      assert.equal(foreignRead.status, 404);

      const projectDelete = {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE PROJECT" }),
      };
      const first = await fetch(`${base}/projects/${projectId}`, projectDelete);
      const repeated = await fetch(`${base}/projects/${projectId}`, projectDelete);
      assert.equal(first.status, 204);
      assert.equal(repeated.status, 404);
      assert.equal(await repeated.json().then((body) => body.error.code), "NOT_FOUND");
      const repeatedBody = await fetch(`${base}/projects/not-a-uuid`, projectDelete).then(
        (response) => response.json(),
      );
      assert.equal(repeatedBody.error.code, "VALIDATION_ERROR");
      assert.match(repeatedBody.error.requestId, /^[0-9a-f-]{36}$/iu);
      const account = await fetch(`${base}/account`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirmation: ACCOUNT_DELETE_CONFIRMATION,
          password: "recent-auth-proof",
        }),
      });
      assert.equal(account.status, 204);
      owner.user = null;
    } finally {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await cleanupOwner(foreignOwner);
      await cleanupOwner(owner);
    }
  });
});
describe("M6.2 remediation checks", () => {
  it("deduplicates writing activity by user and idempotency key", async () => {
    const owner = await createOwner("activity-owner");
    try {
      const first = await services.recordWritingActivity(owner.principal, {
        idempotencyKey: "retry-key",
        wordsAdded: 10,
      });
      const second = await services.recordWritingActivity(owner.principal, {
        idempotencyKey: "retry-key",
        wordsAdded: 999,
      });
      assert.equal(second.id, first.id);
      assert.equal(second.wordsAdded, 10);
    } finally {
      await cleanupOwner(owner);
    }
  });

  it("isolates writing goals and preferences by user", async () => {
    const firstOwner = await createOwner("goal-owner-a");
    const secondOwner = await createOwner("goal-owner-b");
    try {
      await services.createWritingGoal(firstOwner.principal, {
        period: "DAILY",
        targetWords: 100,
        startsAt: "2026-01-01",
      });
      await services.updateUserPreferences(firstOwner.principal, {
        theme: "DARK",
        editorFontSize: 20,
      });

      assert.deepEqual(await services.listWritingGoals(secondOwner.principal), []);
      const secondPreferences = await services.getUserPreferences(secondOwner.principal);
      assert.equal(secondPreferences.theme, "SYSTEM");
      assert.equal(secondPreferences.editorFontSize, 18);
    } finally {
      await cleanupOwner(firstOwner);
      await cleanupOwner(secondOwner);
    }
  });
});
