const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  assertOwned,
  ownedDocumentWhere,
  ownedProjectWhere,
  ownedWorldEntryWhere,
  ownedWorldWhere,
} = require("../src/ownership");
const { createLifecycleServices, LifecycleError } = require("../src/services/resource-lifecycle");

describe("ownership helpers", () => {
  it("scopes project lookups to the owner", () => {
    assert.deepEqual(ownedProjectWhere("user-1", "project-1"), {
      ownerId: "user-1",
      id: "project-1",
    });
  });

  it("scopes document lookups through the project owner", () => {
    assert.deepEqual(ownedDocumentWhere("user-1", "document-1", { deletedAt: null }), {
      project: { ownerId: "user-1" },
      deletedAt: null,
      id: "document-1",
    });
  });

  it("scopes world and world-entry lookups to the owner", () => {
    assert.deepEqual(ownedWorldWhere("user-1"), { ownerId: "user-1" });
    assert.deepEqual(ownedWorldEntryWhere("user-1", "entry-1"), {
      world: { ownerId: "user-1" },
      id: "entry-1",
    });
  });

  it("throws a not-found error for unowned resources", () => {
    assert.throws(
      () => assertOwned(null),
      (error) => error.code === "NOT_FOUND" && error.status === 404,
    );
  });
});

describe("unauthorized resource access", () => {
  it("returns NOT_FOUND when a document is not owned by the authenticated user", async () => {
    const prisma = {
      $transaction: async (operation) => operation(prisma),
      document: {
        findFirst: async () => null,
      },
    };
    const services = createLifecycleServices({
      prisma,
      authenticate: async (principal) => ({ userId: principal.userId }),
      verifyRecentAuthentication: async () => false,
    });

    await assert.rejects(
      () => services.getDocumentContent({ userId: "user-1" }, "foreign-document"),
      (error) =>
        error instanceof LifecycleError && error.code === "NOT_FOUND" && error.status === 404,
    );
  });
});
