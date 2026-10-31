"use strict";

const SESSION_COOKIE_NAME = "astrelune_session";

const safeUserSelect = Object.freeze({
  id: true,
  email: true,
  displayName: true,
  createdAt: true,
  updatedAt: true,
  emailVerifiedAt: true,
  disabledAt: true,
});

function readCookie(req, name) {
  const header = req && req.headers ? req.headers.cookie : undefined;
  if (typeof header !== "string" || header.length === 0) return null;

  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (key !== name) continue;

    const value = trimmed.slice(separatorIndex + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
}

function createSessionAuthenticationMiddleware({ prisma, sessionService }) {
  if (!prisma || typeof prisma.user?.findUnique !== "function") {
    throw new TypeError("A Prisma client is required.");
  }
  if (!sessionService || typeof sessionService.findSession !== "function") {
    throw new TypeError("A session service is required.");
  }

  return async function authenticateRequest(req, res, next) {
    console.log("AUTH_MIDDLEWARE", req.method, req.path, "cookie", req.headers.cookie);
    try {
      const token = readCookie(req, SESSION_COOKIE_NAME);
      if (!token) {
        return res.status(401).json({
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication is required.",
            requestId: req.requestId,
          },
        });
      }

      const session = await sessionService.findSession(token);
      if (!session) {
        return res.status(401).json({
          error: {
            code: "INVALID_SESSION",
            message: "Authentication is required.",
            requestId: req.requestId,
          },
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: safeUserSelect,
      });

      if (!user || user.disabledAt) {
        return res.status(401).json({
          error: {
            code: "INVALID_SESSION",
            message: "Authentication is required.",
            requestId: req.requestId,
          },
        });
      }

      req.session = session;
      req.user = user;
      req.authenticatedPrincipal = { userId: user.id };

      return next();
    } catch {
      return res.status(401).json({
        error: {
          code: "INVALID_SESSION",
          message: "Authentication is required.",
          requestId: req.requestId,
        },
      });
    }
  };
}

module.exports = {
  SESSION_COOKIE_NAME,
  createSessionAuthenticationMiddleware,
  readCookie,
};
