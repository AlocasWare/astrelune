const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { createLifecycleServices, LifecycleError } = require("../src/services/resource-lifecycle");

describe("project operations", () => {
  function makeServices(prisma) {
    return createLifecycleServices({
      prisma,
      authenticate: async (principal) => ({ userId: principal.userId }),
      verifyRecentAuthentication: async () => false,
    });
  }

  it("lists only the authenticated user's projects", async () => {
    const prisma = {
      $transaction: async (operation) => operation(prisma),
      project: {
        findMany: async ({ where }) => {
          assert.equal(where.ownerId, "user-1");
          return [{ id: "project-1", ownerId: "user-1", title: "Owned" }];
        },
      },
    };
    const services = makeServices(prisma);
    const projects = await services.listProjects({ userId: "user-1" });
    assert.equal(projects.length, 1);
    assert.equal(projects[0].id, "project-1");
  });

  it("rejects access to another user's project", async () => {
    const prisma = {
      $transaction: async (operation) => operation(prisma),
      project: {
        findFirst: async () => null,
      },
    };
    const services = makeServices(prisma);
    await assert.rejects(
      () => services.getProject({ userId: "user-1" }, "foreign-project"),
      (error) => error instanceof LifecycleError && error.code === "NOT_FOUND",
    );
  });

  it("updates owned project metadata", async () => {
    const prisma = {
      $transaction: async (operation) => operation(prisma),
      project: {
        findFirst: async () => ({ id: "project-1" }),
        update: async ({ data }) => ({
          id: "project-1",
          title: data.title,
          description: data.description,
        }),
      },
      operationalEvent: { create: async () => ({}) },
    };
    const services = makeServices(prisma);
    const project = await services.updateProject({ userId: "user-1" }, "project-1", {
      title: "Renamed",
      description: "Updated",
    });
    assert.equal(project.title, "Renamed");
    assert.equal(project.description, "Updated");
  });

  it("archives an owned project", async () => {
    const prisma = {
      $transaction: async (operation) => operation(prisma),
      project: {
        findFirst: async () => ({ id: "project-1" }),
        update: async ({ data }) => ({
          id: "project-1",
          status: data.status,
          archivedAt: data.archivedAt,
        }),
      },
      operationalEvent: { create: async () => ({}) },
    };
    const services = makeServices(prisma);
    const project = await services.archiveProject({ userId: "user-1" }, "project-1");
    assert.equal(project.status, "ARCHIVED");
    assert.ok(project.archivedAt instanceof Date);
  });
  it("retrieves an archived project", async () => {
    const prisma = {
      $transaction: async (operation) => operation(prisma),
      project: {
        findFirst: async () => ({
          id: "project-1",
          ownerId: "user-1",
          title: "Archived project",
          status: "ARCHIVED",
          archivedAt: new Date("2026-01-02T00:00:00.000Z"),
        }),
      },
    };
    const services = makeServices(prisma);
    const project = await services.getProject({ userId: "user-1" }, "project-1");
    assert.equal(project.status, "ARCHIVED");
  });

  it("includes archived projects in list results", async () => {
    const prisma = {
      $transaction: async (operation) => operation(prisma),
      project: {
        findMany: async ({ where }) => {
          assert.equal(where.ownerId, "user-1");
          return [
            { id: "active-project", ownerId: "user-1", status: "ACTIVE", archivedAt: null },
            {
              id: "archived-project",
              ownerId: "user-1",
              status: "ARCHIVED",
              archivedAt: new Date(),
            },
          ];
        },
      },
    };
    const services = makeServices(prisma);
    const projects = await services.listProjects({ userId: "user-1" });
    assert.equal(projects.length, 2);
    assert.ok(projects.some((project) => project.status === "ARCHIVED"));
  });
});
