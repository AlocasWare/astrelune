const { isDeepStrictEqual } = require("node:util");
const {
  createDocumentSchema,
  createProjectSchema,
  createWorldEntryRelationshipSchema,
  createWorldEntrySchema,
  createWorldSchema,
  createWritingActivitySchema,
  createWritingGoalSchema,
  parseEditorDocument,
  saveDocumentSchema,
  updateProjectSchema,
  updateWorldEntryRelationshipSchema,
  updateWorldEntrySchema,
  updateWorldSchema,
  updateUserPreferencesSchema,
  updateWritingGoalSchema,
} = require("@astrelune/validation");
const ACCOUNT_DELETE_CONFIRMATION = "DELETE MY ACCOUNT";
const SUPPORTED_CONTENT_SCHEMA_VERSION = 1;
const MAX_TRANSACTION_ATTEMPTS = 4;

class LifecycleError extends Error {
  constructor(code, status, message = code) {
    super(message);
    this.name = "LifecycleError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, status, message) {
  throw new LifecycleError(code, status, message);
}

function assertRequestKey(value) {
  if (typeof value !== "string") fail("INVALID_IDEMPOTENCY_KEY", 400);
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 128 || trimmed !== value) {
    fail("INVALID_IDEMPOTENCY_KEY", 400);
  }
}

function assertContentSchemaVersion(value) {
  if (!Number.isInteger(value) || value < 1) fail("INVALID_CONTENT_SCHEMA_VERSION", 422);
  if (value !== SUPPORTED_CONTENT_SCHEMA_VERSION) fail("UNSUPPORTED_CONTENT_SCHEMA_VERSION", 422);
}

function parseInput(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) fail("VALIDATION_ERROR", 422, "Request validation failed.");
  return result.data;
}

function validateEditorDocument(value) {
  try {
    return parseEditorDocument(value);
  } catch {
    fail("INVALID_EDITOR_CONTENT", 422, "Content does not match the supported editor schema.");
  }
}

function plainTextFromEditorDocument(document) {
  const parts = [];
  const visit = (node) => {
    if (node.type === "text") parts.push(node.text);
    if (Array.isArray(node.content)) node.content.forEach(visit);
    if (["paragraph", "heading", "hardBreak", "listItem"].includes(node.type)) parts.push(" ");
  };
  visit(document);
  return parts
    .join("")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function countWords(text) {
  return text.trim() ? text.trim().split(/\s+/u).length : 0;
}

function isRetryableTransactionError(error) {
  return error && (error.code === "P2034" || error.code === "P2002");
}

async function serializable(prisma, operation) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      if (!isRetryableTransactionError(error)) throw error;
      if (attempt >= MAX_TRANSACTION_ATTEMPTS) fail("CONCURRENT_WRITE_CONFLICT", 409);
    }
  }
}

function treeDeleteOrder(rows, rootId, idField = "id") {
  const remaining = new Map(rows.map((row) => [row[idField], row]));
  const order = [];
  while (remaining.size > 0) {
    const parents = new Set([...remaining.values()].map((row) => row.parentId).filter(Boolean));
    const leaves = [...remaining.keys()].filter((id) => !parents.has(id));
    if (leaves.length === 0)
      fail("TREE_INTEGRITY_VIOLATION", 409, "A cycle was found in the resource tree.");
    for (const id of leaves) {
      order.push(id);
      remaining.delete(id);
    }
  }
  if (!order.includes(rootId)) fail("TREE_INTEGRITY_VIOLATION", 409);
  return order;
}

async function collectDocumentSubtree(tx, root, projectId = root.projectId) {
  const byId = new Map([[root.id, root]]);
  let frontier = [root.id];
  while (frontier.length > 0) {
    const children = await tx.document.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true, parentId: true, projectId: true },
    });
    frontier = [];
    for (const child of children) {
      if (child.projectId !== projectId) fail("RESOURCE_BOUNDARY_VIOLATION", 409);
      if (!byId.has(child.id)) {
        byId.set(child.id, child);
        frontier.push(child.id);
      }
    }
  }
  return [...byId.values()];
}

async function collectWorldEntrySubtree(tx, root, worldId = root.worldId) {
  const byId = new Map([[root.id, root]]);
  let frontier = [root.id];
  while (frontier.length > 0) {
    const children = await tx.worldEntry.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true, parentId: true, worldId: true },
    });
    frontier = [];
    for (const child of children) {
      if (child.worldId !== worldId) fail("RESOURCE_BOUNDARY_VIOLATION", 409);
      if (!byId.has(child.id)) {
        byId.set(child.id, child);
        frontier.push(child.id);
      }
    }
  }
  return [...byId.values()];
}

async function deleteWorldEntries(tx, worldId) {
  const rows = await tx.worldEntry.findMany({
    where: { worldId },
    select: { id: true, parentId: true },
  });
  if (rows.length === 0) return;
  const ids = rows.map((row) => row.id);
  const externalChild = await tx.worldEntry.findFirst({
    where: { parentId: { in: ids }, worldId: { not: worldId } },
    select: { id: true },
  });
  if (externalChild) fail("RESOURCE_BOUNDARY_VIOLATION", 409);
  const roots = rows.filter((row) => !row.parentId || !ids.includes(row.parentId));
  const order = [];
  for (const root of roots) {
    const subtree = await collectWorldEntrySubtree(tx, root, worldId);
    order.push(...treeDeleteOrder(subtree, root.id));
  }
  if (order.length !== rows.length) fail("TREE_INTEGRITY_VIOLATION", 409);
  for (const id of order) await tx.worldEntry.delete({ where: { id } });
}

async function deleteProjectRows(tx, project) {
  const rows = await tx.document.findMany({
    where: { projectId: project.id },
    select: { id: true, parentId: true },
  });
  if (rows.length > 0) {
    const ids = rows.map((row) => row.id);
    const externalChild = await tx.document.findFirst({
      where: { parentId: { in: ids }, projectId: { not: project.id } },
      select: { id: true },
    });
    if (externalChild) fail("RESOURCE_BOUNDARY_VIOLATION", 409);
    const roots = rows.filter((row) => !row.parentId || !ids.includes(row.parentId));
    const order = [];
    for (const root of roots) {
      const subtree = await collectDocumentSubtree(tx, { ...root, projectId: project.id });
      order.push(...treeDeleteOrder(subtree, root.id));
    }
    if (order.length !== rows.length) fail("TREE_INTEGRITY_VIOLATION", 409);
    for (const id of order) await tx.document.delete({ where: { id } });
  }
  await tx.project.delete({ where: { id: project.id } });
}

function createLifecycleServices({ prisma, authenticate, verifyRecentAuthentication }) {
  if (!prisma || typeof prisma.$transaction !== "function")
    throw new TypeError("A Prisma client is required.");
  if (typeof authenticate !== "function")
    throw new TypeError("An authenticate(principal) verifier is required.");
  if (typeof verifyRecentAuthentication !== "function")
    throw new TypeError("A recent-authentication verifier is required.");

  async function actorFor(principal) {
    const identity = await authenticate(principal);
    if (!identity || typeof identity.userId !== "string") fail("UNAUTHENTICATED", 401);
    return identity.userId;
  }

  async function recordEvent(tx, actorUserId, eventType, resourceType, resourceId) {
    await tx.operationalEvent.create({
      data: { actorUserId, eventType, resourceType, resourceId },
    });
  }

  async function deleteUserAccount(principal, { confirmation, reauthenticationProof } = {}) {
    const userId = await actorFor(principal);
    if (confirmation !== ACCOUNT_DELETE_CONFIRMATION) fail("CONFIRMATION_REQUIRED", 400);
    if (!(await verifyRecentAuthentication(principal, reauthenticationProof)))
      fail("RECENT_AUTHENTICATION_REQUIRED", 401);
    return serializable(prisma, async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) fail("NOT_FOUND", 404);
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const projects = await tx.project.findMany({
        where: { ownerId: userId },
        select: { id: true },
      });
      for (const project of projects) await deleteProjectRows(tx, project);
      const worlds = await tx.world.findMany({ where: { ownerId: userId }, select: { id: true } });
      for (const world of worlds) {
        await deleteWorldEntries(tx, world.id);
        await tx.world.delete({ where: { id: world.id } });
      }
      await tx.writingGoal.deleteMany({ where: { userId } });
      await tx.writingActivity.deleteMany({ where: { userId } });
      await tx.userPreferences.deleteMany({ where: { userId } });
      await recordEvent(tx, userId, "ACCOUNT_DELETED", "USER", userId);
      await tx.user.delete({ where: { id: userId } });
      return { deleted: true, resourceId: userId };
    });
  }

  async function deleteProject(principal, projectId) {
    const userId = await actorFor(principal);
    return serializable(prisma, async (tx) => {
      const project = await tx.project.findFirst({ where: { id: projectId, ownerId: userId } });
      if (!project) fail("NOT_FOUND", 404);
      await deleteProjectRows(tx, project);
      await recordEvent(tx, userId, "PROJECT_DELETED", "PROJECT", projectId);
      return { deleted: true, resourceId: projectId };
    });
  }

  async function deleteDocumentSubtree(principal, documentId) {
    const userId = await actorFor(principal);
    return serializable(prisma, async (tx) => {
      const document = await tx.document.findFirst({
        where: { id: documentId, deletedAt: null, project: { ownerId: userId } },
        select: { id: true, projectId: true, parentId: true },
      });
      if (!document) fail("NOT_FOUND", 404);
      const rows = await collectDocumentSubtree(tx, document);
      const order = treeDeleteOrder(rows, document.id);
      for (const id of order) await tx.document.delete({ where: { id } });
      await recordEvent(tx, userId, "DOCUMENT_SUBTREE_DELETED", "DOCUMENT", documentId);
      return { deleted: true, resourceId: documentId };
    });
  }

  async function deleteWorld(principal, worldId) {
    const userId = await actorFor(principal);
    return serializable(prisma, async (tx) => {
      const world = await tx.world.findFirst({
        where: { id: worldId, ownerId: userId },
        select: { id: true },
      });
      if (!world) fail("NOT_FOUND", 404);
      await deleteWorldEntries(tx, worldId);
      await tx.world.delete({ where: { id: worldId } });
      await recordEvent(tx, userId, "WORLD_DELETED", "WORLD", worldId);
      return { deleted: true, resourceId: worldId };
    });
  }

  async function restoreDocumentRevision(
    principal,
    documentId,
    revisionId,
    requestKey,
    contentVersion,
  ) {
    const userId = await actorFor(principal);
    assertRequestKey(requestKey);
    return serializable(prisma, async (tx) => {
      const document = await tx.document.findFirst({
        where: { id: documentId, deletedAt: null, project: { ownerId: userId } },
      });
      if (!document) fail("NOT_FOUND", 404);
      if (document.kind === "FOLDER") fail("FOLDER_CANNOT_CONTAIN_CONTENT", 409);
      if (contentVersion !== undefined && document.contentVersion !== contentVersion)
        fail("DOCUMENT_VERSION_CONFLICT", 409, "This document changed after you opened it.");
      const source = await tx.documentRevision.findFirst({ where: { id: revisionId, documentId } });
      if (!source) fail("NOT_FOUND", 404);
      const existing = await tx.documentRevision.findFirst({ where: { documentId, requestKey } });
      if (existing) {
        if (
          existing.reason !== "RESTORE" ||
          !isDeepStrictEqual(existing.content, source.content) ||
          existing.contentSchemaVersion !== source.contentSchemaVersion
        ) {
          fail("IDEMPOTENCY_KEY_REUSE", 409);
        }
        return {
          restored: true,
          idempotent: true,
          revisionId: existing.id,
          revisionNumber: existing.revisionNumber,
        };
      }
      validateEditorDocument(source.content);
      const { plainText, wordCount } = source;
      const maxRevision = await tx.documentRevision.aggregate({
        where: { documentId },
        _max: { revisionNumber: true },
      });
      const nextRevisionNumber = (maxRevision._max.revisionNumber || 0) + 1;
      const restored = await tx.document.update({
        where: { id: documentId },
        data: {
          content: source.content,
          contentSchemaVersion: source.contentSchemaVersion,
          plainText,
          wordCount,
          contentVersion: { increment: 1 },
        },
      });
      const revision = await tx.documentRevision.create({
        data: {
          documentId,
          revisionNumber: nextRevisionNumber,
          content: source.content,
          plainText,
          wordCount,
          contentSchemaVersion: source.contentSchemaVersion,
          documentVersion: restored.contentVersion,
          createdById: userId,
          requestKey,
          reason: "RESTORE",
        },
      });
      await recordEvent(tx, userId, "DOCUMENT_REVISION_RESTORED", "DOCUMENT", documentId);
      return {
        restored: true,
        idempotent: false,
        revisionId: revision.id,
        revisionNumber: revision.revisionNumber,
        contentVersion: restored.contentVersion,
      };
    });
  }

  async function saveDocument(principal, documentId, input, requestKey) {
    const userId = await actorFor(principal);
    assertRequestKey(requestKey);
    const {
      contentVersion,
      contentSchemaVersion,
      content: rawContent,
    } = parseInput(saveDocumentSchema, input);
    if (!Number.isInteger(contentVersion) || contentVersion < 0)
      fail("INVALID_CONTENT_VERSION", 422);
    assertContentSchemaVersion(contentSchemaVersion);
    const content = validateEditorDocument(rawContent);
    const plainText = plainTextFromEditorDocument(content);
    const wordCount = countWords(plainText);
    return serializable(prisma, async (tx) => {
      const document = await tx.document.findFirst({
        where: { id: documentId, deletedAt: null, project: { ownerId: userId } },
      });
      if (!document) fail("NOT_FOUND", 404);
      if (document.kind === "FOLDER") fail("FOLDER_CANNOT_CONTAIN_CONTENT", 422);
      const existing = await tx.documentRevision.findFirst({ where: { documentId, requestKey } });
      if (existing) {
        if (
          !isDeepStrictEqual(existing.content, content) ||
          existing.contentSchemaVersion !== contentSchemaVersion
        )
          fail("IDEMPOTENCY_KEY_REUSE", 409);
        return {
          saved: true,
          idempotent: true,
          revisionId: existing.id,
          revisionNumber: existing.revisionNumber,
          document: {
            id: documentId,
            contentVersion: existing.documentVersion,
            contentSchemaVersion: existing.contentSchemaVersion,
            wordCount: existing.wordCount,
            updatedAt: existing.createdAt,
          },
          saveStatus: "saved",
        };
      }
      if (document.contentVersion !== contentVersion) {
        fail("DOCUMENT_VERSION_CONFLICT", 409, "This document changed after you opened it.");
      }
      const maxRevision = await tx.documentRevision.aggregate({
        where: { documentId },
        _max: { revisionNumber: true },
      });
      const revisionNumber = (maxRevision._max.revisionNumber || 0) + 1;
      const cas = await tx.document.updateMany({
        where: { id: documentId, projectId: document.projectId, deletedAt: null, contentVersion },
        data: {
          content,
          contentSchemaVersion,
          plainText,
          wordCount,
          contentVersion: { increment: 1 },
        },
      });
      if (cas.count !== 1)
        fail("DOCUMENT_VERSION_CONFLICT", 409, "This document changed after you opened it.");
      const updated = await tx.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          contentVersion: true,
          contentSchemaVersion: true,
          wordCount: true,
          updatedAt: true,
        },
      });
      const revision = await tx.documentRevision.create({
        data: {
          documentId,
          revisionNumber,
          content,
          plainText,
          wordCount,
          contentSchemaVersion,
          documentVersion: updated.contentVersion,
          createdById: userId,
          requestKey,
          reason: "MANUAL_CHECKPOINT",
        },
      });
      const wordsAdded = Math.max(0, wordCount - document.wordCount);
      if (wordsAdded > 0) {
        const priorActivity = await tx.writingActivity.findUnique({
          where: {
            userId_documentId_idempotencyKey: { userId, documentId, idempotencyKey: requestKey },
          },
        });
        if (priorActivity) fail("IDEMPOTENCY_KEY_REUSE", 409);
        await tx.writingActivity.upsert({
          where: {
            userId_documentId_idempotencyKey: { userId, documentId, idempotencyKey: requestKey },
          },
          create: {
            userId,
            projectId: document.projectId,
            documentId,
            idempotencyKey: requestKey,
            activityDate: new Date(new Date().toISOString().slice(0, 10)),
            wordsAdded,
          },
          update: {},
        });
      }
      await recordEvent(tx, userId, "DOCUMENT_SAVED", "DOCUMENT", documentId);
      return {
        saved: true,
        idempotent: false,
        revisionId: revision.id,
        revisionNumber,
        document: updated,
        saveStatus: "saved",
      };
    });
  }

  async function getDocumentContent(principal, documentId) {
    const userId = await actorFor(principal);
    const document = await prisma.document.findFirst({
      where: { id: documentId, deletedAt: null, project: { ownerId: userId } },
      select: {
        id: true,
        content: true,
        contentVersion: true,
        contentSchemaVersion: true,
        wordCount: true,
        updatedAt: true,
      },
    });
    if (!document) fail("NOT_FOUND", 404);
    return document;
  }

  async function listDocumentRevisions(principal, documentId) {
    const userId = await actorFor(principal);
    const document = await prisma.document.findFirst({
      where: { id: documentId, deletedAt: null, project: { ownerId: userId } },
      select: { id: true },
    });
    if (!document) fail("NOT_FOUND", 404);

    return prisma.documentRevision.findMany({
      where: { documentId },
      orderBy: { revisionNumber: "desc" },
      select: {
        id: true,
        documentId: true,
        revisionNumber: true,
        documentVersion: true,
        contentSchemaVersion: true,
        wordCount: true,
        reason: true,
        createdById: true,
        createdAt: true,
      },
    });
  }
  async function getDocumentRevision(principal, documentId, revisionId) {
    const userId = await actorFor(principal);
    const document = await prisma.document.findFirst({
      where: { id: documentId, deletedAt: null, project: { ownerId: userId } },
      select: { id: true },
    });
    if (!document) fail("NOT_FOUND", 404);

    const revision = await prisma.documentRevision.findFirst({
      where: { id: revisionId, documentId },
    });
    if (!revision) fail("NOT_FOUND", 404);
    return revision;
  }

  async function compareDocumentRevisions(principal, documentId, fromRevisionId, toRevisionId) {
    const from = await getDocumentRevision(principal, documentId, fromRevisionId);
    const to = await getDocumentRevision(principal, documentId, toRevisionId);
    return {
      from,
      to,
      left: from,
      right: to,
      diff: {
        wordCount: to.wordCount - from.wordCount,
        contentChanged: !isDeepStrictEqual(from.content, to.content),
        contentSchemaVersionChanged: from.contentSchemaVersion !== to.contentSchemaVersion,
      },
    };
  }
  async function moveDocument(principal, documentId, parentIdOrOptions, positionArg) {
    const userId = await actorFor(principal);
    let parentId = parentIdOrOptions;
    let position = positionArg;
    let hasParent = false;
    let hasPosition = positionArg !== undefined;
    let hasTitle = false;
    let title;
    if (
      parentIdOrOptions &&
      typeof parentIdOrOptions === "object" &&
      !Array.isArray(parentIdOrOptions)
    ) {
      hasParent = Object.prototype.hasOwnProperty.call(parentIdOrOptions, "parentId");
      parentId = hasParent ? parentIdOrOptions.parentId : undefined;
      hasPosition = Object.prototype.hasOwnProperty.call(parentIdOrOptions, "position");
      position = hasPosition ? parentIdOrOptions.position : undefined;
      hasTitle = Object.prototype.hasOwnProperty.call(parentIdOrOptions, "title");
      title = parentIdOrOptions.title;
    } else {
      hasParent = parentIdOrOptions !== undefined;
      if (!hasParent) parentId = undefined;
    }
    if (parentId === undefined && !hasParent) parentId = undefined;

    return serializable(prisma, async (tx) => {
      const document = await tx.document.findFirst({
        where: { id: documentId, deletedAt: null, project: { ownerId: userId } },
        select: { id: true, projectId: true },
      });
      if (!document) fail("NOT_FOUND", 404);
      if (hasParent && parentId !== null) {
        const parent = await tx.document.findFirst({
          where: {
            id: parentId,
            projectId: document.projectId,
            project: { ownerId: userId },
            deletedAt: null,
          },
          select: { id: true, kind: true },
        });
        if (!parent) fail("NOT_FOUND", 404);
        const descendants = await collectDocumentSubtree(tx, { ...document, parentId: null });
        if (descendants.some((row) => row.id === parentId)) fail("DOCUMENT_CYCLE", 409);
        if (!["FOLDER", "CHAPTER"].includes(parent.kind))
          fail("PARENT_CANNOT_CONTAIN_DOCUMENTS", 422);
      }
      await tx.document.update({
        where: { id: documentId },
        data: {
          ...(hasParent ? { parentId } : {}),
          ...(hasPosition ? { position } : {}),
          ...(hasTitle ? { title } : {}),
        },
      });
      await recordEvent(tx, userId, "DOCUMENT_UPDATED", "DOCUMENT", documentId);
      return { updated: true, resourceId: documentId };
    });
  }

  async function linkWorldToProject(principal, projectId, worldId) {
    const userId = await actorFor(principal);
    return serializable(prisma, async (tx) => {
      const [project, world] = await Promise.all([
        tx.project.findFirst({ where: { id: projectId, ownerId: userId }, select: { id: true } }),
        tx.world.findFirst({ where: { id: worldId, ownerId: userId }, select: { id: true } }),
      ]);
      if (!project || !world) fail("NOT_FOUND", 404);
      await tx.projectWorld.upsert({
        where: { projectId_worldId: { projectId, worldId } },
        create: { projectId, worldId },
        update: {},
      });
      await recordEvent(tx, userId, "WORLD_LINKED_TO_PROJECT", "PROJECT", projectId);
      return { linked: true, projectId, worldId };
    });
  }

  async function createProject(principal, input) {
    const userId = await actorFor(principal);
    const { title, description } = parseInput(createProjectSchema, input);
    return serializable(prisma, async (tx) => {
      const project = await tx.project.create({ data: { ownerId: userId, title, description } });
      await recordEvent(tx, userId, "PROJECT_CREATED", "PROJECT", project.id);
      return project;
    });
  }

  async function listProjects(principal) {
    const userId = await actorFor(principal);
    return prisma.project.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: "desc" },
    });
  }

  async function getProject(principal, projectId) {
    const userId = await actorFor(principal);
    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
    });
    if (!project) fail("NOT_FOUND", 404);
    return project;
  }

  async function updateProject(principal, projectId, input) {
    const userId = await actorFor(principal);
    const { title, description } = parseInput(updateProjectSchema, input);
    return serializable(prisma, async (tx) => {
      const project = await tx.project.findFirst({
        where: { id: projectId, ownerId: userId },
        select: { id: true },
      });
      if (!project) fail("NOT_FOUND", 404);

      const updated = await tx.project.update({
        where: { id: projectId },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
        },
      });
      await recordEvent(tx, userId, "PROJECT_UPDATED", "PROJECT", projectId);
      return updated;
    });
  }

  async function archiveProject(principal, projectId) {
    const userId = await actorFor(principal);
    return serializable(prisma, async (tx) => {
      const project = await tx.project.findFirst({
        where: { id: projectId, ownerId: userId },
        select: { id: true },
      });
      if (!project) fail("NOT_FOUND", 404);

      const archived = await tx.project.update({
        where: { id: projectId },
        data: { status: "ARCHIVED", archivedAt: new Date() },
      });
      await recordEvent(tx, userId, "PROJECT_ARCHIVED", "PROJECT", projectId);
      return archived;
    });
  }

  async function createWorld(principal, input) {
    const userId = await actorFor(principal);
    const { name, description } = parseInput(createWorldSchema, input);
    return serializable(prisma, async (tx) => {
      const world = await tx.world.create({ data: { ownerId: userId, name, description } });
      await recordEvent(tx, userId, "WORLD_CREATED", "WORLD", world.id);
      return world;
    });
  }
  async function listWorlds(principal) {
    const userId = await actorFor(principal);
    return prisma.world.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: "desc" },
    });
  }

  async function getWorld(principal, worldId) {
    const userId = await actorFor(principal);
    const world = await prisma.world.findFirst({
      where: { id: worldId, ownerId: userId },
    });
    if (!world) fail("NOT_FOUND", 404);
    return world;
  }

  async function updateWorld(principal, worldId, input) {
    const userId = await actorFor(principal);
    const { name, description } = parseInput(updateWorldSchema, input);
    return serializable(prisma, async (tx) => {
      const world = await tx.world.findFirst({
        where: { id: worldId, ownerId: userId },
        select: { id: true },
      });
      if (!world) fail("NOT_FOUND", 404);

      const updated = await tx.world.update({
        where: { id: worldId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
        },
      });
      await recordEvent(tx, userId, "WORLD_UPDATED", "WORLD", worldId);
      return updated;
    });
  }

  async function unlinkWorldFromProject(principal, projectId, worldId) {
    const userId = await actorFor(principal);
    return serializable(prisma, async (tx) => {
      const [project, world] = await Promise.all([
        tx.project.findFirst({ where: { id: projectId, ownerId: userId }, select: { id: true } }),
        tx.world.findFirst({ where: { id: worldId, ownerId: userId }, select: { id: true } }),
      ]);
      if (!project || !world) fail("NOT_FOUND", 404);

      await tx.projectWorld.deleteMany({ where: { projectId, worldId } });
      await recordEvent(tx, userId, "WORLD_UNLINKED_FROM_PROJECT", "PROJECT", projectId);
      return { unlinked: true, projectId, worldId };
    });
  }

  async function listDocuments(principal, projectId) {
    const userId = await actorFor(principal);
    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
      select: { id: true },
    });
    if (!project) fail("NOT_FOUND", 404);

    return prisma.document.findMany({
      where: { projectId, deletedAt: null },
      orderBy: [{ parentId: "asc" }, { position: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        kind: true,
        parentId: true,
        position: true,
        wordCount: true,
        updatedAt: true,
      },
    });
  }

  async function duplicateDocument(principal, documentId) {
    const userId = await actorFor(principal);
    return serializable(prisma, async (tx) => {
      const root = await tx.document.findFirst({
        where: { id: documentId, deletedAt: null, project: { ownerId: userId } },
      });
      if (!root) fail("NOT_FOUND", 404);

      const subtreeRows = await collectDocumentSubtree(tx, root);
      const ids = subtreeRows.map((row) => row.id);
      const originals = await tx.document.findMany({ where: { id: { in: ids } } });
      const originalById = new Map(originals.map((row) => [row.id, row]));
      const childrenByParent = new Map();
      for (const row of subtreeRows) {
        if (!childrenByParent.has(row.parentId)) childrenByParent.set(row.parentId, []);
        childrenByParent.get(row.parentId).push(row.id);
      }

      const order = [];
      const queue = [root.id];
      while (queue.length > 0) {
        const id = queue.shift();
        order.push(id);
        for (const childId of childrenByParent.get(id) || []) queue.push(childId);
      }

      const oldToNew = new Map();
      let rootCopy = null;
      for (const oldId of order) {
        const original = originalById.get(oldId);
        if (!original) fail("TREE_INTEGRITY_VIOLATION", 409);
        const newParentId = oldId === root.id ? root.parentId : oldToNew.get(original.parentId);
        const copy = await tx.document.create({
          data: {
            projectId: original.projectId,
            parentId: newParentId,
            title: original.title,
            kind: original.kind,
            position: original.position,
            content: original.content,
            contentSchemaVersion: original.contentSchemaVersion,
            plainText: original.plainText,
            wordCount: original.wordCount,
            contentVersion: original.contentVersion,
          },
        });
        oldToNew.set(oldId, copy.id);
        if (oldId === root.id) rootCopy = copy;
      }

      await recordEvent(tx, userId, "DOCUMENT_DUPLICATED", "DOCUMENT", root.id);
      return rootCopy;
    });
  }

  async function createDocument(principal, projectId, input) {
    const userId = await actorFor(principal);
    const { title, kind, parentId = null, position = 0 } = parseInput(createDocumentSchema, input);
    return serializable(prisma, async (tx) => {
      const project = await tx.project.findFirst({
        where: { id: projectId, ownerId: userId },
        select: { id: true },
      });
      if (!project) fail("NOT_FOUND", 404);
      if (parentId !== null) {
        const parent = await tx.document.findFirst({
          where: { id: parentId, projectId, deletedAt: null },
          select: { id: true, kind: true },
        });
        if (!parent) fail("NOT_FOUND", 404);
        if (!["FOLDER", "CHAPTER"].includes(parent.kind))
          fail("PARENT_CANNOT_CONTAIN_DOCUMENTS", 422);
      }
      const document = await tx.document.create({
        data: { projectId, parentId, title, kind, position },
      });
      await recordEvent(tx, userId, "DOCUMENT_CREATED", "DOCUMENT", document.id);
      return document;
    });
  }

  async function createWorldEntry(principal, worldId, input) {
    const userId = await actorFor(principal);
    const {
      name,
      parentId = null,
      kind,
      summary,
      content: rawContent,
    } = parseInput(createWorldEntrySchema, input);
    const contentSchemaVersion = SUPPORTED_CONTENT_SCHEMA_VERSION;
    const content = validateEditorDocument(rawContent);
    return serializable(prisma, async (tx) => {
      const world = await tx.world.findFirst({
        where: { id: worldId, ownerId: userId },
        select: { id: true },
      });
      if (!world) fail("NOT_FOUND", 404);
      if (parentId !== null) {
        const parent = await tx.worldEntry.findFirst({
          where: { id: parentId, worldId },
          select: { id: true },
        });
        if (!parent) fail("NOT_FOUND", 404);
      }
      const entry = await tx.worldEntry.create({
        data: { worldId, parentId, name, kind, summary, content, contentSchemaVersion },
      });
      await recordEvent(tx, userId, "WORLD_ENTRY_CREATED", "WORLD_ENTRY", entry.id);
      return entry;
    });
  }
  async function createWorldEntryRelationship(principal, worldId, input) {
    const userId = await actorFor(principal);
    const { sourceEntryId, targetEntryId, relationshipType, description } = parseInput(
      createWorldEntryRelationshipSchema,
      input,
    );
    return serializable(prisma, async (tx) => {
      const world = await tx.world.findFirst({
        where: { id: worldId, ownerId: userId },
        select: { id: true },
      });
      if (!world) fail("NOT_FOUND", 404);

      const [source, target] = await Promise.all([
        tx.worldEntry.findFirst({ where: { id: sourceEntryId, worldId }, select: { id: true } }),
        tx.worldEntry.findFirst({ where: { id: targetEntryId, worldId }, select: { id: true } }),
      ]);
      if (!source || !target) fail("NOT_FOUND", 404);

      const relationship = await tx.worldEntryRelationship.upsert({
        where: {
          sourceEntryId_targetEntryId_relationshipType: {
            sourceEntryId,
            targetEntryId,
            relationshipType,
          },
        },
        create: { sourceEntryId, targetEntryId, relationshipType, description },
        update: { description },
      });
      await recordEvent(
        tx,
        userId,
        "WORLD_ENTRY_RELATIONSHIP_CREATED",
        "WORLD_ENTRY",
        sourceEntryId,
      );
      return relationship;
    });
  }

  async function listWorldEntryRelationships(principal, worldId, entryId) {
    const userId = await actorFor(principal);
    const world = await prisma.world.findFirst({
      where: { id: worldId, ownerId: userId },
      select: { id: true },
    });
    if (!world) fail("NOT_FOUND", 404);

    const where = entryId
      ? {
          OR: [{ sourceEntryId: entryId }, { targetEntryId: entryId }],
          sourceEntry: { worldId },
        }
      : { sourceEntry: { worldId } };

    return prisma.worldEntryRelationship.findMany({
      where,
      include: {
        sourceEntry: { select: { id: true, name: true, kind: true } },
        targetEntry: { select: { id: true, name: true, kind: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async function getWorldEntryRelationship(principal, worldId, relationshipId) {
    const userId = await actorFor(principal);
    const world = await prisma.world.findFirst({
      where: { id: worldId, ownerId: userId },
      select: { id: true },
    });
    if (!world) fail("NOT_FOUND", 404);

    const relationship = await prisma.worldEntryRelationship.findFirst({
      where: { id: relationshipId, sourceEntry: { worldId } },
      include: {
        sourceEntry: { select: { id: true, name: true, kind: true } },
        targetEntry: { select: { id: true, name: true, kind: true } },
      },
    });
    if (!relationship) fail("NOT_FOUND", 404);
    return relationship;
  }

  async function updateWorldEntryRelationship(principal, worldId, relationshipId, input) {
    const userId = await actorFor(principal);
    const { relationshipType, description } = parseInput(updateWorldEntryRelationshipSchema, input);
    return serializable(prisma, async (tx) => {
      const world = await tx.world.findFirst({
        where: { id: worldId, ownerId: userId },
        select: { id: true },
      });
      if (!world) fail("NOT_FOUND", 404);

      const relationship = await tx.worldEntryRelationship.findFirst({
        where: { id: relationshipId, sourceEntry: { worldId } },
      });
      if (!relationship) fail("NOT_FOUND", 404);

      try {
        const updated = await tx.worldEntryRelationship.update({
          where: { id: relationshipId },
          data: {
            ...(relationshipType !== undefined ? { relationshipType } : {}),
            ...(description !== undefined ? { description } : {}),
          },
        });
        await recordEvent(
          tx,
          userId,
          "WORLD_ENTRY_RELATIONSHIP_UPDATED",
          "WORLD_ENTRY",
          relationship.sourceEntryId,
        );
        return updated;
      } catch (error) {
        if (error && error.code === "P2002") fail("DUPLICATE_RELATIONSHIP", 409);
        throw error;
      }
    });
  }

  async function deleteWorldEntryRelationship(principal, worldId, relationshipId) {
    const userId = await actorFor(principal);
    return serializable(prisma, async (tx) => {
      const world = await tx.world.findFirst({
        where: { id: worldId, ownerId: userId },
        select: { id: true },
      });
      if (!world) fail("NOT_FOUND", 404);

      const relationship = await tx.worldEntryRelationship.findFirst({
        where: { id: relationshipId, sourceEntry: { worldId } },
        select: { id: true, sourceEntryId: true },
      });
      if (!relationship) fail("NOT_FOUND", 404);

      await tx.worldEntryRelationship.delete({ where: { id: relationshipId } });
      await recordEvent(
        tx,
        userId,
        "WORLD_ENTRY_RELATIONSHIP_DELETED",
        "WORLD_ENTRY",
        relationship.sourceEntryId,
      );
      return { deleted: true, resourceId: relationshipId };
    });
  }

  async function listWorldEntries(principal, worldId, kind) {
    const userId = await actorFor(principal);
    const world = await prisma.world.findFirst({
      where: { id: worldId, ownerId: userId },
      select: { id: true },
    });
    if (!world) fail("NOT_FOUND", 404);

    const where = { worldId };
    if (kind) where.kind = kind;
    return prisma.worldEntry.findMany({
      where,
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
    });
  }

  async function getWorldEntry(principal, worldId, entryId) {
    const userId = await actorFor(principal);
    const world = await prisma.world.findFirst({
      where: { id: worldId, ownerId: userId },
      select: { id: true },
    });
    if (!world) fail("NOT_FOUND", 404);

    const entry = await prisma.worldEntry.findFirst({
      where: { id: entryId, worldId },
    });
    if (!entry) fail("NOT_FOUND", 404);
    return entry;
  }

  async function updateWorldEntry(principal, worldId, entryId, input) {
    const userId = await actorFor(principal);
    const {
      name,
      kind,
      parentId,
      summary,
      content: rawContent,
    } = parseInput(updateWorldEntrySchema, input);
    return serializable(prisma, async (tx) => {
      const world = await tx.world.findFirst({
        where: { id: worldId, ownerId: userId },
        select: { id: true },
      });
      if (!world) fail("NOT_FOUND", 404);

      const entry = await tx.worldEntry.findFirst({
        where: { id: entryId, worldId },
        select: { id: true, kind: true },
      });
      if (!entry) fail("NOT_FOUND", 404);

      if (parentId !== undefined && parentId !== null) {
        const parent = await tx.worldEntry.findFirst({
          where: { id: parentId, worldId },
          select: { id: true },
        });
        if (!parent) fail("NOT_FOUND", 404);
      }

      const content = rawContent === undefined ? undefined : validateEditorDocument(rawContent);
      const updated = await tx.worldEntry.update({
        where: { id: entryId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(kind !== undefined ? { kind } : {}),
          ...(parentId !== undefined ? { parentId } : {}),
          ...(summary !== undefined ? { summary } : {}),
          ...(content !== undefined
            ? { content, contentSchemaVersion: SUPPORTED_CONTENT_SCHEMA_VERSION }
            : {}),
        },
      });
      await recordEvent(tx, userId, "WORLD_ENTRY_UPDATED", "WORLD_ENTRY", entryId);
      return updated;
    });
  }

  async function deleteWorldEntry(principal, worldId, entryId) {
    const userId = await actorFor(principal);
    return serializable(prisma, async (tx) => {
      const world = await tx.world.findFirst({
        where: { id: worldId, ownerId: userId },
        select: { id: true },
      });
      if (!world) fail("NOT_FOUND", 404);

      const entry = await tx.worldEntry.findFirst({
        where: { id: entryId, worldId },
        select: { id: true },
      });
      if (!entry) fail("NOT_FOUND", 404);

      // Delete descendants leaf-first to satisfy restrictive self-relations.
      const rows = await tx.worldEntry.findMany({
        where: { worldId },
        select: { id: true, parentId: true },
      });
      const descendants = new Set([entryId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const row of rows) {
          if (row.parentId && descendants.has(row.parentId) && !descendants.has(row.id)) {
            descendants.add(row.id);
            changed = true;
          }
        }
      }
      for (const id of descendants) {
        await tx.worldEntry.delete({ where: { id } });
      }
      await recordEvent(tx, userId, "WORLD_ENTRY_DELETED", "WORLD_ENTRY", entryId);
      return { deleted: true, resourceId: entryId };
    });
  }

  async function linkDocumentToWorldEntry(
    principal,
    documentId,
    worldEntryId,
    relationshipType = "REFERENCES",
  ) {
    const userId = await actorFor(principal);
    return serializable(prisma, async (tx) => {
      const [document, entry] = await Promise.all([
        tx.document.findFirst({
          where: { id: documentId, deletedAt: null, project: { ownerId: userId } },
          select: { id: true, projectId: true },
        }),
        tx.worldEntry.findFirst({
          where: { id: worldEntryId, world: { ownerId: userId } },
          select: { id: true, worldId: true },
        }),
      ]);
      if (!document || !entry) fail("NOT_FOUND", 404);

      const projectWorld = await tx.projectWorld.findFirst({
        where: { projectId: document.projectId, worldId: entry.worldId },
        select: { projectId: true },
      });
      if (!projectWorld) fail("NOT_FOUND", 404);

      await tx.documentWorldEntry.upsert({
        where: {
          documentId_worldEntryId_relationshipType: { documentId, worldEntryId, relationshipType },
        },
        create: { documentId, worldEntryId, relationshipType },
        update: {},
      });
      await recordEvent(tx, userId, "WORLD_ENTRY_LINKED_TO_DOCUMENT", "DOCUMENT", documentId);
      return { linked: true, documentId, worldEntryId, relationshipType };
    });
  }

  async function listDocumentWorldEntries(principal, documentId) {
    const userId = await actorFor(principal);
    const document = await prisma.document.findFirst({
      where: { id: documentId, deletedAt: null, project: { ownerId: userId } },
      select: { id: true },
    });
    if (!document) fail("NOT_FOUND", 404);

    return prisma.documentWorldEntry.findMany({
      where: { documentId },
      include: {
        worldEntry: {
          select: { id: true, name: true, kind: true, worldId: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async function listWorldEntryDocuments(principal, worldEntryId) {
    const userId = await actorFor(principal);
    const entry = await prisma.worldEntry.findFirst({
      where: { id: worldEntryId, world: { ownerId: userId } },
      select: { id: true, worldId: true },
    });
    if (!entry) fail("NOT_FOUND", 404);

    return prisma.documentWorldEntry.findMany({
      where: { worldEntryId },
      include: {
        document: {
          select: { id: true, title: true, kind: true, projectId: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async function unlinkDocumentFromWorldEntry(
    principal,
    documentId,
    worldEntryId,
    relationshipType = "REFERENCES",
  ) {
    const userId = await actorFor(principal);
    return serializable(prisma, async (tx) => {
      const document = await tx.document.findFirst({
        where: { id: documentId, deletedAt: null, project: { ownerId: userId } },
        select: { id: true, projectId: true },
      });
      if (!document) fail("NOT_FOUND", 404);

      const entry = await tx.worldEntry.findFirst({
        where: { id: worldEntryId, world: { ownerId: userId } },
        select: { id: true, worldId: true },
      });
      if (!entry) fail("NOT_FOUND", 404);

      const projectWorld = await tx.projectWorld.findFirst({
        where: { projectId: document.projectId, worldId: entry.worldId },
        select: { projectId: true },
      });
      if (!projectWorld) fail("NOT_FOUND", 404);

      await tx.documentWorldEntry.deleteMany({
        where: { documentId, worldEntryId, relationshipType },
      });
      await recordEvent(tx, userId, "WORLD_ENTRY_UNLINKED_FROM_DOCUMENT", "DOCUMENT", documentId);
      return { unlinked: true, documentId, worldEntryId, relationshipType };
    });
  }

  async function linkWorldEntries(
    principal,
    sourceEntryId,
    targetEntryId,
    relationshipType,
    description = null,
  ) {
    const userId = await actorFor(principal);
    return serializable(prisma, async (tx) => {
      const [source, target] = await Promise.all([
        tx.worldEntry.findFirst({
          where: { id: sourceEntryId, world: { ownerId: userId } },
          select: { id: true, worldId: true },
        }),
        tx.worldEntry.findFirst({
          where: { id: targetEntryId, world: { ownerId: userId } },
          select: { id: true, worldId: true },
        }),
      ]);
      if (!source || !target || source.worldId !== target.worldId) fail("NOT_FOUND", 404);
      await tx.worldEntryRelationship.upsert({
        where: {
          sourceEntryId_targetEntryId_relationshipType: {
            sourceEntryId,
            targetEntryId,
            relationshipType,
          },
        },
        create: { sourceEntryId, targetEntryId, relationshipType, description },
        update: { description },
      });
      await recordEvent(tx, userId, "WORLD_ENTRIES_LINKED", "WORLD_ENTRY", sourceEntryId);
      return { linked: true, sourceEntryId, targetEntryId };
    });
  }

  async function listWritingGoals(principal) {
    const userId = await actorFor(principal);
    return prisma.writingGoal.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }

  async function getWritingGoal(principal, goalId) {
    const userId = await actorFor(principal);
    const goal = await prisma.writingGoal.findFirst({ where: { id: goalId, userId } });
    if (!goal) fail("NOT_FOUND", 404);
    return goal;
  }

  async function createWritingGoal(principal, input) {
    const userId = await actorFor(principal);
    const body = parseInput(createWritingGoalSchema, input);
    if (body.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: body.projectId, ownerId: userId },
        select: { id: true },
      });
      if (!project) fail("NOT_FOUND", 404);
    }
    return prisma.writingGoal.create({
      data: {
        userId,
        period: body.period,
        targetWords: body.targetWords,
        startsAt: new Date(`${body.startsAt}T00:00:00.000Z`),
        endsAt: body.endsAt ? new Date(`${body.endsAt}T00:00:00.000Z`) : null,
        projectId: body.projectId ?? null,
      },
    });
  }

  async function updateWritingGoal(principal, goalId, input) {
    const userId = await actorFor(principal);
    const existing = await prisma.writingGoal.findFirst({ where: { id: goalId, userId } });
    if (!existing) fail("NOT_FOUND", 404);
    const body = parseInput(updateWritingGoalSchema, input);
    if (body.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: body.projectId, ownerId: userId },
        select: { id: true },
      });
      if (!project) fail("NOT_FOUND", 404);
    }
    const data = {};
    if (body.period !== undefined) data.period = body.period;
    if (body.targetWords !== undefined) data.targetWords = body.targetWords;
    if (body.startsAt !== undefined) data.startsAt = new Date(`${body.startsAt}T00:00:00.000Z`);
    if (body.endsAt !== undefined)
      data.endsAt = body.endsAt ? new Date(`${body.endsAt}T00:00:00.000Z`) : null;
    if (body.projectId !== undefined) data.projectId = body.projectId;

    const startsAt = body.startsAt ?? existing.startsAt.toISOString().slice(0, 10);
    const endsAt =
      body.endsAt === undefined
        ? (existing.endsAt?.toISOString().slice(0, 10) ?? null)
        : body.endsAt;
    if (endsAt && endsAt < startsAt)
      fail("VALIDATION_ERROR", 422, "End date must be on or after the start date.");

    return prisma.writingGoal.update({ where: { id: goalId }, data });
  }

  async function deleteWritingGoal(principal, goalId) {
    const userId = await actorFor(principal);
    const existing = await prisma.writingGoal.findFirst({
      where: { id: goalId, userId },
      select: { id: true },
    });
    if (!existing) fail("NOT_FOUND", 404);
    await prisma.writingGoal.delete({ where: { id: goalId } });
    return { deleted: true, goalId };
  }

  async function recordWritingActivity(principal, input) {
    const userId = await actorFor(principal);
    const body = parseInput(createWritingActivitySchema, input);
    if (body.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: body.projectId, ownerId: userId },
        select: { id: true },
      });
      if (!project) fail("NOT_FOUND", 404);
    }
    if (body.documentId) {
      const document = await prisma.document.findFirst({
        where: { id: body.documentId, project: { ownerId: userId } },
        select: { id: true },
      });
      if (!document) fail("NOT_FOUND", 404);
    }

    const existing = await prisma.writingActivity.findFirst({
      where: { userId, idempotencyKey: body.idempotencyKey },
    });
    if (existing) return existing;

    const activityDate = body.activityDate
      ? new Date(`${body.activityDate}T00:00:00.000Z`)
      : new Date();

    return prisma.writingActivity.create({
      data: {
        userId,
        projectId: body.projectId ?? null,
        documentId: body.documentId ?? null,
        idempotencyKey: body.idempotencyKey,
        activityDate,
        wordsAdded: body.wordsAdded ?? 0,
      },
    });
  }

  async function listWritingActivity(principal, filters = {}) {
    const userId = await actorFor(principal);
    const where = { userId };
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.from || filters.to) {
      where.activityDate = {};
      if (filters.from) where.activityDate.gte = new Date(`${filters.from}T00:00:00.000Z`);
      if (filters.to) where.activityDate.lte = new Date(`${filters.to}T00:00:00.000Z`);
    }
    return prisma.writingActivity.findMany({ where, orderBy: { activityDate: "desc" } });
  }

  function utcDayString(date) {
    return date.toISOString().slice(0, 10);
  }

  function mondayOfWeek(dateString) {
    const date = new Date(`${dateString}T00:00:00.000Z`);
    const day = date.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setUTCDate(date.getUTCDate() + diff);
    return date;
  }

  async function getWritingGoalProgress(principal, goalId) {
    const goal = await getWritingGoal(principal, goalId);
    const todayString = utcDayString(new Date());
    let periodStart;
    let periodEnd;
    if (goal.period === "DAILY") {
      periodStart = new Date(`${todayString}T00:00:00.000Z`);
      periodEnd = new Date(`${todayString}T00:00:00.000Z`);
    } else {
      periodStart = mondayOfWeek(todayString);
      const end = new Date(periodStart);
      end.setUTCDate(end.getUTCDate() + 6);
      periodEnd = end;
    }

    if (periodStart < goal.startsAt) periodStart = goal.startsAt;
    if (goal.endsAt && periodEnd > goal.endsAt) periodEnd = goal.endsAt;

    let wordsAdded = 0;
    if (periodStart <= periodEnd) {
      const aggregate = await prisma.writingActivity.aggregate({
        where: {
          userId: goal.userId,
          activityDate: { gte: periodStart, lte: periodEnd },
          ...(goal.projectId ? { projectId: goal.projectId } : {}),
        },
        _sum: { wordsAdded: true },
      });
      wordsAdded = aggregate._sum.wordsAdded ?? 0;
    }

    const expired = goal.endsAt !== null && todayString > goal.endsAt.toISOString().slice(0, 10);

    return {
      goal,
      periodStart: periodStart.toISOString().slice(0, 10),
      periodEnd: periodEnd.toISOString().slice(0, 10),
      wordsAdded,
      targetWords: goal.targetWords,
      status: expired ? "EXPIRED" : "ACTIVE",
    };
  }
  const defaultPreferences = {
    theme: "SYSTEM",
    editorFontFamily: "serif",
    editorFontSize: 18,
    editorLineHeight: 1.7,
    focusModeDefault: false,
  };

  async function getUserPreferences(principal) {
    const userId = await actorFor(principal);
    const existing = await prisma.userPreferences.findUnique({ where: { userId } });
    if (existing) return existing;
    return { userId, ...defaultPreferences, updatedAt: new Date() };
  }

  async function updateUserPreferences(principal, input) {
    const userId = await actorFor(principal);
    const body = parseInput(updateUserPreferencesSchema, input);
    return prisma.userPreferences.upsert({
      where: { userId },
      create: { userId, ...defaultPreferences, ...body },
      update: body,
    });
  }

  return {
    deleteUserAccount,
    deleteProject,
    deleteDocumentSubtree,
    deleteWorld,
    restoreDocumentRevision,
    saveDocument,
    getDocumentContent,
    getDocumentRevision,
    compareDocumentRevisions,
    listDocumentRevisions,
    moveDocument,
    linkWorldToProject,
    unlinkWorldFromProject,
    createProject,
    listProjects,
    getProject,
    updateProject,
    archiveProject,
    createWorld,
    listWorlds,
    getWorld,
    updateWorld,
    createDocument,
    duplicateDocument,
    listDocuments,
    createWorldEntry,
    createWorldEntryRelationship,
    listWorldEntries,
    listWorldEntryRelationships,
    getWorldEntry,
    getWorldEntryRelationship,
    updateWorldEntry,
    updateWorldEntryRelationship,
    deleteWorldEntry,
    deleteWorldEntryRelationship,
    linkDocumentToWorldEntry,
    listDocumentWorldEntries,
    listWorldEntryDocuments,
    unlinkDocumentFromWorldEntry,
    linkWorldEntries,
    listWritingGoals,
    getWritingGoal,
    createWritingGoal,
    updateWritingGoal,
    deleteWritingGoal,
    recordWritingActivity,
    listWritingActivity,
    getWritingGoalProgress,
    getUserPreferences,
    updateUserPreferences,
  };
}

module.exports = {
  ACCOUNT_DELETE_CONFIRMATION,
  LifecycleError,
  createLifecycleServices,
  validateEditorDocument,
  plainTextFromEditorDocument,
  countWords,
};
