"use strict";

function createRateLimiter({ windowMs = 60_000, max = 10, keyGenerator } = {}) {
  const hits = new Map();

  function getKey(req) {
    if (typeof keyGenerator === "function") return keyGenerator(req);
    return req.ip || req.socket?.remoteAddress || "unknown";
  }

  return function rateLimit(req, res, next) {
    const key = getKey(req);
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again later.",
          requestId: req.requestId,
        },
      });
    }

    return next();
  };
}

function normalizeOrigin(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function createOriginValidationMiddleware({ allowedOrigins = [] } = {}) {
  const allowed = new Set(allowedOrigins.filter(Boolean));

  return function validateOrigin(req, res, next) {
    const method = req.method ? req.method.toUpperCase() : "GET";
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return next();

    const hasSessionCookie =
      typeof req.headers?.cookie === "string" && req.headers.cookie.includes("astrelune_session=");
    if (!hasSessionCookie) return next();

    const requestOrigin = normalizeOrigin(req.headers.origin);
    const refererOrigin = normalizeOrigin(req.headers.referer);
    const candidate = requestOrigin || refererOrigin;

    if (!candidate) return next();

    if (allowed.has(candidate)) return next();

    const host = req.headers.host;
    if (host && (candidate === `http://${host}` || candidate === `https://${host}`)) return next();

    return res.status(403).json({
      error: {
        code: "CSRF_VALIDATION_FAILED",
        message: "Request origin is not allowed.",
        requestId: req.requestId,
      },
    });
  };
}

module.exports = {
  createOriginValidationMiddleware,
  createRateLimiter,
};
