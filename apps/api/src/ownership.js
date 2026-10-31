"use strict";

function ownedProjectWhere(userId, projectId = undefined) {
  const where = { ownerId: userId };
  if (projectId !== undefined) where.id = projectId;
  return where;
}

function ownedWorldWhere(userId, worldId = undefined) {
  const where = { ownerId: userId };
  if (worldId !== undefined) where.id = worldId;
  return where;
}

function ownedDocumentWhere(userId, documentId = undefined, extra = {}) {
  const where = {
    project: { ownerId: userId },
    ...extra,
  };
  if (documentId !== undefined) where.id = documentId;
  return where;
}

function ownedWorldEntryWhere(userId, entryId = undefined, extra = {}) {
  const where = {
    world: { ownerId: userId },
    ...extra,
  };
  if (entryId !== undefined) where.id = entryId;
  return where;
}

function assertOwned(record, code = "NOT_FOUND", status = 404, message = code) {
  if (!record) {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    throw error;
  }
  return record;
}

module.exports = {
  assertOwned,
  ownedDocumentWhere,
  ownedProjectWhere,
  ownedWorldEntryWhere,
  ownedWorldWhere,
};
