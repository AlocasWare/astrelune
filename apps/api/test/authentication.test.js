const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  createAuthenticationService,
  AuthenticationError,
} = require("../src/services/authentication");

describe("authentication service", () => {
  function makeService({ user = null, passwordValid = false } = {}) {
    const prisma = {
      user: {
        findUnique: async () => user,
      },
    };
    const sessionService = {
      createSession: async (userId) => {
        assert.equal(userId, user?.id);
        return { token: "session-token" };
      },
    };

    return createAuthenticationService({
      prisma,
      sessionService,
      verifyPassword: async () => passwordValid,
    });
  }

  it("verifies the password and returns a safe user plus session token", async () => {
    const service = makeService({
      user: {
        id: "user-id",
        email: "person@example.com",
        displayName: "Person",
        passwordHash: "stored-hash",
      },
      passwordValid: true,
    });

    const result = await service.login({
      email: "  Person@Example.COM ",
      password: "secret123",
    });

    assert.equal(result.user.id, "user-id");
    assert.equal(result.user.email, "person@example.com");
    assert.equal(Object.prototype.hasOwnProperty.call(result.user, "passwordHash"), false);
    assert.equal(result.sessionToken, "session-token");
  });

  it("uses a generic failure for unknown accounts", async () => {
    const service = makeService({ user: null });

    await assert.rejects(
      () => service.login({ email: "missing@example.com", password: "secret123" }),
      AuthenticationError,
    );
  });

  it("uses the same generic failure for incorrect passwords", async () => {
    const service = makeService({
      user: {
        id: "user-id",
        email: "person@example.com",
        displayName: "Person",
        passwordHash: "stored-hash",
      },
      passwordValid: false,
    });

    await assert.rejects(
      () => service.login({ email: "person@example.com", password: "wrong" }),
      AuthenticationError,
    );
  });
});
