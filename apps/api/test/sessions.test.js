const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { createSessionService, SessionUserNotFoundError } = require("../src/services/sessions");
const { generateSessionToken, hashSessionToken } = require("../src/session");

describe("session service", () => {
  it("generates, hashes, and persists a session", async () => {
    const created = {
      id: "session-id",
      userId: "user-id",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2026-01-31T00:00:00.000Z"),
      lastSeenAt: new Date("2026-01-01T00:00:00.000Z"),
      revokedAt: null,
    };
    let persistedHash = null;
    const prisma = {
      user: {
        findUnique: async () => ({ id: "user-id" }),
      },
      session: {
        create: async ({ data }) => {
          persistedHash = data.tokenHash;
          assert.equal(data.userId, "user-id");
          assert.ok(data.tokenHash.length === 64);
          return created;
        },
      },
    };

    const service = createSessionService({ prisma, sessionTtlMs: 1000 });
    const result = await service.createSession("user-id", {
      expiresAt: new Date("2026-01-31T00:00:00.000Z"),
    });

    assert.equal(typeof result.token, "string");
    assert.equal(result.session.id, "session-id");
    assert.notEqual(result.token, persistedHash);
    assert.equal(persistedHash, hashSessionToken(result.token));
  });

  it("rejects sessions for unknown users", async () => {
    const prisma = {
      user: {
        findUnique: async () => null,
      },
      session: {
        create: async () => {
          throw new Error("create should not be called");
        },
      },
    };

    const service = createSessionService({ prisma });
    await assert.rejects(() => service.createSession("missing-user"), SessionUserNotFoundError);
  });

  it("finds a valid session by hashing the presented token", async () => {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const future = new Date(Date.now() + 60_000);
    const prisma = {
      session: {
        findUnique: async ({ where }) => {
          assert.equal(where.tokenHash, tokenHash);
          return {
            id: "session-id",
            userId: "user-id",
            tokenHash,
            createdAt: new Date(),
            expiresAt: future,
            lastSeenAt: new Date(),
            revokedAt: null,
          };
        },
      },
    };

    const service = createSessionService({ prisma });
    const session = await service.findSession(token);

    assert.equal(session.id, "session-id");
    assert.equal(Object.prototype.hasOwnProperty.call(session, "tokenHash"), false);
  });

  it("rejects expired sessions", async () => {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const prisma = {
      session: {
        findUnique: async () => ({
          id: "session-id",
          userId: "user-id",
          tokenHash,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() - 60_000),
          lastSeenAt: new Date(),
          revokedAt: null,
        }),
      },
    };

    const service = createSessionService({ prisma });
    assert.equal(await service.findSession(token), null);
  });

  it("rejects revoked sessions", async () => {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const prisma = {
      session: {
        findUnique: async () => ({
          id: "session-id",
          userId: "user-id",
          tokenHash,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
          lastSeenAt: new Date(),
          revokedAt: new Date(),
        }),
      },
    };

    const service = createSessionService({ prisma });
    assert.equal(await service.findSession(token), null);
  });

  it("revokes a matching session", async () => {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    let updated = false;
    const prisma = {
      session: {
        findUnique: async () => ({ id: "session-id", revokedAt: null }),
        update: async ({ where, data }) => {
          assert.equal(where.tokenHash, tokenHash);
          assert.ok(data.revokedAt instanceof Date);
          updated = true;
          return {};
        },
      },
    };

    const service = createSessionService({ prisma });
    await service.revokeSession(token);
    assert.equal(updated, true);
  });

  it("revokes all active sessions for a user", async () => {
    const prisma = {
      session: {
        updateMany: async ({ where, data }) => {
          assert.equal(where.userId, "user-id");
          assert.equal(where.revokedAt, null);
          assert.ok(data.revokedAt instanceof Date);
          return { count: 3 };
        },
      },
    };

    const service = createSessionService({ prisma });
    assert.equal(await service.revokeAllSessions("user-id"), 3);
  });
});
