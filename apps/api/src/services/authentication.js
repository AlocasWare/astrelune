"use strict";

const { verifyPassword } = require("../password");
const { createSessionService } = require("./sessions");

class AuthenticationError extends Error {
  constructor() {
    super("Invalid email or password.");
    this.name = "AuthenticationError";
    this.code = "INVALID_CREDENTIALS";
    this.status = 401;
  }
}

const safeUserSelect = Object.freeze({
  id: true,
  email: true,
  displayName: true,
  createdAt: true,
  updatedAt: true,
  emailVerifiedAt: true,
  disabledAt: true,
});

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : email;
}

function createAuthenticationService({
  prisma,
  sessionService,
  sessionTtlMs,
  verifyPassword: verifyPasswordImpl = verifyPassword,
} = {}) {
  if (!prisma || typeof prisma.user?.findUnique !== "function") {
    throw new TypeError("A Prisma client is required.");
  }

  const sessions = sessionService || createSessionService({ prisma, sessionTtlMs });

  async function login(credentials) {
    const email = normalizeEmail(credentials?.email);
    const password = credentials?.password;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        ...safeUserSelect,
        passwordHash: true,
      },
    });

    if (!user) throw new AuthenticationError();

    const passwordValid = await verifyPasswordImpl(password, user.passwordHash);
    if (!passwordValid) throw new AuthenticationError();

    const safeUser = { ...user };
    delete safeUser.passwordHash;

    const { token, session } = await sessions.createSession(safeUser.id);

    return {
      user: safeUser,
      sessionToken: token,
      session,
    };
  }

  async function logout(sessionToken) {
    await sessions.revokeSession(sessionToken);
  }

  return {
    login,
    authenticate: login,
    logout,
  };
}

module.exports = {
  AuthenticationError,
  createAuthenticationService,
};
