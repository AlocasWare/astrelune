const assert = require("node:assert/strict");
const { once } = require("node:events");
const { describe, it } = require("node:test");
const express = require("express");
const { createApiApp } = require("../src/app");

async function withApi(prisma, run) {
  const app = createApiApp({
    express,
    prisma,
    services: {},
    authenticateRequest: (_req, _res, next) => next(),
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

describe("API health endpoints", () => {
  it("reports when the API is live", async () => {
    await withApi(null, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health/live`);

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: "ok" });
      assert.match(response.headers.get("x-request-id"), /^[0-9a-f-]{36}$/iu);
    });
  });

  it("reports a healthy database query", async () => {
    let queryCount = 0;
    await withApi(
      {
        $queryRaw: async () => {
          queryCount += 1;
        },
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/health/db`);

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { status: "ok", database: "ok" });
        assert.equal(queryCount, 1);
      },
    );
  });

  it("reports an unavailable database when no client is configured", async () => {
    await withApi(null, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health/db`);

      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { status: "error", database: "unavailable" });
    });
  });

  it("reports a failed database query as unavailable", async () => {
    await withApi(
      {
        $queryRaw: async () => {
          throw new Error("database details must not be exposed");
        },
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/health/db`);

        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { status: "error", database: "unavailable" });
      },
    );
  });
});
