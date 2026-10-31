"use strict";

const { generateSessionToken, hashSessionToken } = require("../session");

class SessionUserNotFoundError extends Error {
  constructor() {
    super("Session user does not exist.");
    this.name = "SessionUserNotFoundError";
    this.code = "SESSION_USER_NOT_FOUND";
    this.status = 404;
  }
}

const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const safeSessionSelect = Object.freeze({
  id: true,
  userId: true,
  createdAt: true,
  expiresAt: true,
  lastSeenAt: true,
  revokedAt: true,
});

function now() {
  return new Date();
}

function createSessionService({ prisma, sessionTtlMs = DEFAULT_SESSION_TTL_MS } = {}) {
  if (!prisma || !prisma.session || typeof prisma.session !== "object") {
    throw new TypeError("A Prisma client is required.");
  }

  async function createSession(userId, options = {}) {
    if (typeof userId !== "string" || userId.length === 0) {
      throw new TypeError("A user ID is required.");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new SessionUserNotFoundError();

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt =
      options.expiresAt instanceof Date
        ? options.expiresAt
        : new Date(now().getTime() + sessionTtlMs);

    const session = await prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
      select: safeSessionSelect,
    });

    return { token, session };
  }

  async function findSession(token) {
    let tokenHash;
    try {
      tokenHash = hashSessionToken(token);
    } catch {
      return null;
    }

    const session = await prisma.session.findUnique({
      where: { tokenHash },
    });

    if (!session) return null;
    if (session.revokedAt !== null) return null;
    if (session.expiresAt <= now()) return null;

    const safeSession = { ...session };
    delete safeSession.tokenHash;
    return safeSession;
  }

  async function revokeSession(token) {
    let tokenHash;
    try {
      tokenHash = hashSessionToken(token);
    } catch {
      return;
    }

    const session = await prisma.session.findUnique({
      where: { tokenHash },
      select: { id: true, revokedAt: true },
    });

    if (!session || session.revokedAt !== null) return;

    await prisma.session.update({
      where: { tokenHash },
      data: { revokedAt: now() },
    });
  }

  async function revokeSessionById(sessionId) {
    if (typeof sessionId !== "string" || sessionId.length === 0) return;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, revokedAt: true },
    });

    if (!session || session.revokedAt !== null) return;

    await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: now() },
    });
  }

  async function revokeAllSessions(userId) {
    if (typeof userId !== "string" || userId.length === 0) return 0;

    const result = await prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: now() },
    });

    return typeof result?.count === "number" ? result.count : 0;
  }

  return {
    createSession,
    findSession,
    findValidSession: findSession,
    revokeSession,
    revokeSessionById,
    revokeAllSessions,
    revokeAllUserSessions: revokeAllSessions,
  };
}

module.exports = {
  DEFAULT_SESSION_TTL_MS,
  SessionUserNotFoundError,
  createSessionService,
};
