const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  createOriginValidationMiddleware,
  createRateLimiter,
} = require("../src/middleware/security");

function mockResponse() {
  const response = {
    statusCode: 200,
    headers: {},
    body: null,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
  return response;
}

describe("security middleware", () => {
  it("rate limits repeated requests", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    const req = { ip: "127.0.0.1", requestId: "req-id" };
    const first = mockResponse();
    const second = mockResponse();
    const third = mockResponse();

    let nextCount = 0;
    limiter(req, first, () => {
      nextCount += 1;
    });
    limiter(req, second, () => {
      nextCount += 1;
    });
    limiter(req, third, () => {
      nextCount += 1;
    });

    assert.equal(nextCount, 2);
    assert.equal(third.statusCode, 429);
    assert.equal(third.body.error.code, "RATE_LIMITED");
  });

  it("rejects state-changing requests from disallowed origins when a session cookie is present", () => {
    const middleware = createOriginValidationMiddleware({
      allowedOrigins: ["https://app.example.com"],
    });
    const req = {
      method: "POST",
      headers: {
        cookie: "astrelune_session=token",
        origin: "https://evil.example.com",
        host: "app.example.com",
      },
      requestId: "req-id",
    };
    const res = mockResponse();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error.code, "CSRF_VALIDATION_FAILED");
  });

  it("accepts state-changing requests from allowed origins", () => {
    const middleware = createOriginValidationMiddleware({
      allowedOrigins: ["https://app.example.com"],
    });
    const req = {
      method: "POST",
      headers: {
        cookie: "astrelune_session=token",
        origin: "https://app.example.com",
        host: "app.example.com",
      },
      requestId: "req-id",
    };
    const res = mockResponse();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
  });

  it("does not apply origin checks to requests without a session cookie", () => {
    const middleware = createOriginValidationMiddleware({ allowedOrigins: [] });
    const req = {
      method: "POST",
      headers: {
        origin: "https://evil.example.com",
        host: "app.example.com",
      },
      requestId: "req-id",
    };
    const res = mockResponse();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
  });
});
