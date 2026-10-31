"use strict";

const argon2 = require("argon2");

const MIN_MEMORY_COST = 8 * 1024;
const MAX_MEMORY_COST = 1024 * 1024;
const MIN_TIME_COST = 1;
const MAX_TIME_COST = 10;
const MIN_PARALLELISM = 1;
const MAX_PARALLELISM = 16;
const MIN_HASH_LENGTH = 16;
const MAX_HASH_LENGTH = 64;
const MAX_PASSWORD_LENGTH = 1024;

function readIntegerOption(name, fallback, minimum, maximum) {
  const rawValue = process.env[name];
  if (rawValue === undefined) return fallback;

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

const passwordOptions = Object.freeze({
  type: argon2.argon2id,
  memoryCost: readIntegerOption(
    "ASTRELUNE_PASSWORD_MEMORY_COST",
    65536,
    MIN_MEMORY_COST,
    MAX_MEMORY_COST,
  ),
  timeCost: readIntegerOption("ASTRELUNE_PASSWORD_TIME_COST", 3, MIN_TIME_COST, MAX_TIME_COST),
  parallelism: readIntegerOption(
    "ASTRELUNE_PASSWORD_PARALLELISM",
    4,
    MIN_PARALLELISM,
    MAX_PARALLELISM,
  ),
  hashLength: readIntegerOption(
    "ASTRELUNE_PASSWORD_HASH_LENGTH",
    32,
    MIN_HASH_LENGTH,
    MAX_HASH_LENGTH,
  ),
});

function assertPassword(password) {
  if (typeof password !== "string" || password.length === 0) {
    throw new TypeError("Password must be a non-empty string.");
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new RangeError("Password exceeds the maximum supported length.");
  }
}

async function hashPassword(password) {
  assertPassword(password);
  // Argon2id hashes are self-describing, so verification can use the stored value directly.
  return argon2.hash(password, passwordOptions);
}

async function verifyPassword(password, passwordHash) {
  if (
    typeof password !== "string" ||
    typeof passwordHash !== "string" ||
    passwordHash.length === 0
  ) {
    return false;
  }

  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    // Verification failures and malformed hashes must not expose password material.
    return false;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
};
