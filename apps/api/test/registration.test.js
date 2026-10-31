const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  createRegistrationService,
  EmailAlreadyExistsError,
  registerUser,
} = require("../src/services/registration");

describe("registration service", () => {
  it("normalizes email, hashes the password, and returns a safe user", async () => {
    const createdUser = {
      id: "user-id",
      email: "person@example.com",
      displayName: "Person",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const prisma = {
      user: {
        findUnique: async () => null,
        create: async ({ data, select }) => {
          assert.equal(data.email, "person@example.com");
          assert.equal(data.displayName, "Person");
          assert.equal(data.passwordHash, "hashed:secret");
          assert.deepEqual(select, {
            id: true,
            email: true,
            displayName: true,
            createdAt: true,
            updatedAt: true,
            emailVerifiedAt: true,
            disabledAt: true,
          });
          return createdUser;
        },
      },
    };

    const service = createRegistrationService({
      prisma,
      hashPassword: async (password) => {
        assert.equal(password, "secret123");
        return "hashed:secret";
      },
    });

    const user = await service.registerUser({
      email: "  Person@Example.COM  ",
      displayName: "  Person  ",
      password: "secret123",
      confirmPassword: "secret123",
    });

    assert.deepEqual(user, createdUser);
    assert.equal(Object.prototype.hasOwnProperty.call(user, "passwordHash"), false);
  });

  it("rejects duplicate emails before hashing", async () => {
    let hashCalled = false;
    const prisma = {
      user: {
        findUnique: async ({ where }) => {
          assert.equal(where.email, "person@example.com");
          return { id: "existing-user" };
        },
        create: async () => {
          throw new Error("create should not be called");
        },
      },
    };

    const service = createRegistrationService({
      prisma,
      hashPassword: async () => {
        hashCalled = true;
        return "hashed";
      },
    });

    await assert.rejects(
      () =>
        service.registerUser({
          email: "Person@Example.com",
          displayName: "Person",
          password: "secret123",
          confirmPassword: "secret123",
        }),
      EmailAlreadyExistsError,
    );
    assert.equal(hashCalled, false);
  });

  it("converts database uniqueness races into duplicate-email errors", async () => {
    const prisma = {
      user: {
        findUnique: async () => null,
        create: async () => {
          const error = new Error("Unique constraint failed");
          error.code = "P2002";
          error.meta = { target: ["email"] };
          throw error;
        },
      },
    };

    const service = createRegistrationService({
      prisma,
      hashPassword: async () => "hashed",
    });

    await assert.rejects(
      () =>
        service.registerUser({
          email: "person@example.com",
          displayName: "Person",
          password: "secret123",
          confirmPassword: "secret123",
        }),
      EmailAlreadyExistsError,
    );
  });

  it("supports the standalone registerUser helper", async () => {
    const prisma = {
      user: {
        findUnique: async () => null,
        create: async ({ data }) => ({
          id: "standalone",
          email: data.email,
          displayName: data.displayName,
        }),
      },
    };

    const user = await registerUser(prisma, {
      email: "standalone@example.com",
      displayName: "Standalone",
      password: "secret123",
      confirmPassword: "secret123",
    });

    assert.equal(user.id, "standalone");
    assert.equal(user.email, "standalone@example.com");
  });
});
