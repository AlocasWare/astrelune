const assert = require("node:assert/strict");
const { once } = require("node:events");
const { describe, it } = require("node:test");
const express = require("express");
const { createApiApp } = require("../src/app");

async function withApi(services, run) {
  const app = createApiApp({
    express,
    services: {},
    authenticateRequest: (_req, _res, next) => next(),
    prisma: null,
    registrationService: services,
    authenticationService: services,
  });
  const server = app.listen(0);
  await once(server, "listening");
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function withAuthenticatedApi(user, run) {
  const app = createApiApp({
    express,
    services: {},
    authenticateRequest: (req, _res, next) => {
      req.user = user;
      req.authenticatedPrincipal = { userId: user.id };
      next();
    },
    prisma: null,
    registrationService: { registerUser: async () => ({}) },
    authenticationService: {
      login: async () => ({ user, sessionToken: "unused" }),
      logout: async () => {},
    },
  });
  const server = app.listen(0);
  await once(server, "listening");
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe("registration endpoint", () => {
  it("creates a user and returns safe public fields", async () => {
    await withApi(
      {
        registerUser: async () => ({
          id: "user-id",
          email: "person@example.com",
          displayName: "Person",
        }),
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/auth/register`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: "person@example.com",
            displayName: "Person",
            password: "password1",
            confirmPassword: "password1",
          }),
        });

        assert.equal(response.status, 201);
        const body = await response.json();
        assert.equal(body.user.id, "user-id");
        assert.equal(body.user.email, "person@example.com");
      },
    );
  });

  it("rejects invalid registration bodies", async () => {
    await withApi({ registerUser: async () => ({}) }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      });

      assert.equal(response.status, 422);
      const body = await response.json();
      assert.equal(body.error.code, "VALIDATION_ERROR");
    });
  });

  it("reports duplicate emails as conflicts", async () => {
    const { EmailAlreadyExistsError } = require("../src/services/registration");
    await withApi(
      {
        registerUser: async () => {
          throw new EmailAlreadyExistsError();
        },
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/auth/register`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: "person@example.com",
            displayName: "Person",
            password: "password1",
            confirmPassword: "password1",
          }),
        });

        assert.equal(response.status, 409);
        const body = await response.json();
        assert.equal(body.error.code, "EMAIL_ALREADY_EXISTS");
      },
    );
  });

  it("does not expose internal errors", async () => {
    await withApi(
      {
        registerUser: async () => {
          throw new Error("database details must not be exposed");
        },
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/auth/register`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: "person@example.com",
            displayName: "Person",
            password: "password1",
            confirmPassword: "password1",
          }),
        });

        assert.equal(response.status, 500);
        const body = await response.json();
        assert.equal(body.error.code, "INTERNAL_ERROR");
        assert.doesNotMatch(JSON.stringify(body), /database details/);
      },
    );
  });
});

describe("login endpoint", () => {
  it("authenticates a user and returns a session token", async () => {
    await withApi(
      {
        registerUser: async () => ({}),
        login: async () => ({
          user: { id: "user-id", email: "person@example.com", displayName: "Person" },
          sessionToken: "session-token",
        }),
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: "person@example.com",
            password: "password1",
          }),
        });

        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.user.id, "user-id");
      },
    );
  });

  it("returns a generic authentication failure", async () => {
    const { AuthenticationError } = require("../src/services/authentication");
    await withApi(
      {
        registerUser: async () => ({}),
        login: async () => {
          throw new AuthenticationError();
        },
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: "person@example.com",
            password: "password1",
          }),
        });

        assert.equal(response.status, 401);
        const body = await response.json();
        assert.equal(body.error.code, "INVALID_CREDENTIALS");
      },
    );
  });
  describe("logout endpoint", () => {
    it("revokes only the presented session", async () => {
      let revokedToken = null;
      await withApi(
        {
          registerUser: async () => ({}),
          login: async () => ({ user: {}, sessionToken: "unused" }),
          logout: async (token) => {
            revokedToken = token;
          },
        },
        async (baseUrl) => {
          const response = await fetch(`${baseUrl}/auth/logout`, {
            method: "POST",
            headers: { authorization: "Bearer presented-token" },
          });

          assert.equal(response.status, 204);
          assert.equal(revokedToken, "presented-token");
        },
      );
    });

    it("treats an already invalid session safely", async () => {
      await withApi(
        {
          registerUser: async () => ({}),
          login: async () => ({ user: {}, sessionToken: "unused" }),
          logout: async () => {},
        },
        async (baseUrl) => {
          const response = await fetch(`${baseUrl}/auth/logout`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token: "unknown-token" }),
          });

          assert.equal(response.status, 204);
        },
      );
    });
  });
});
describe("session restoration endpoint", () => {
  it("returns the authenticated user", async () => {
    await withAuthenticatedApi(
      { id: "user-id", email: "person@example.com", displayName: "Person" },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/auth/me`, { credentials: "include" });

        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.user.id, "user-id");
        assert.equal(Object.prototype.hasOwnProperty.call(body.user, "passwordHash"), false);
      },
    );
  });

  it("rejects unauthenticated requests", async () => {
    await withApi({ registerUser: async () => ({}), login: async () => ({}) }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/me`, { credentials: "include" });

      assert.equal(response.status, 401);
    });
  });
});
