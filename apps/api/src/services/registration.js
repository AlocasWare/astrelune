"use strict";

const { hashPassword } = require("../password");

class RegistrationError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = "RegistrationError";
    this.code = code;
    this.status = status;
  }
}

class EmailAlreadyExistsError extends RegistrationError {
  constructor() {
    super("EMAIL_ALREADY_EXISTS", 409, "An account with that email address already exists.");
    this.name = "EmailAlreadyExistsError";
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

function isPrismaUniqueConstraintError(error) {
  return Boolean(error && (error.code === "P2002" || error.errorCode === "P2002"));
}

function isEmailConflict(error) {
  if (!isPrismaUniqueConstraintError(error)) return false;

  const target = error.meta && error.meta.target;
  if (target === undefined || target === null) return true;
  if (Array.isArray(target)) return target.includes("email");
  return String(target).includes("email");
}

function normalizeRegistrationData(data) {
  if (!data || typeof data !== "object") {
    throw new TypeError("Registration data must be an object.");
  }

  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : data.email;
  const displayName =
    typeof data.displayName === "string" ? data.displayName.trim() : data.displayName;

  return {
    ...data,
    email,
    displayName,
  };
}

async function createRegisteredUser(prisma, data, hashPasswordImpl = hashPassword) {
  if (!prisma || typeof prisma.user?.create !== "function") {
    throw new TypeError("A Prisma client is required.");
  }

  const normalized = normalizeRegistrationData(data);

  const existingUser = await prisma.user.findUnique({
    where: { email: normalized.email },
    select: { id: true },
  });
  if (existingUser) throw new EmailAlreadyExistsError();

  const passwordHash = await hashPasswordImpl(normalized.password);

  try {
    return await prisma.user.create({
      data: {
        email: normalized.email,
        passwordHash,
        displayName: normalized.displayName,
      },
      select: safeUserSelect,
    });
  } catch (error) {
    if (isEmailConflict(error)) throw new EmailAlreadyExistsError();
    throw error;
  }
}

function createRegistrationService({ prisma, hashPassword: hashPasswordImpl = hashPassword } = {}) {
  if (!prisma || typeof prisma.user?.create !== "function") {
    throw new TypeError("A Prisma client is required.");
  }

  return {
    async registerUser(data) {
      return createRegisteredUser(prisma, data, hashPasswordImpl);
    },
  };
}

async function registerUser(prisma, data) {
  return createRegisteredUser(prisma, data, hashPassword);
}

module.exports = {
  EmailAlreadyExistsError,
  RegistrationError,
  createRegistrationService,
  registerUser,
  safeUserSelect,
};
