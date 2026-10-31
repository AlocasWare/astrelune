"use strict";

const crypto = require("node:crypto");

const SESSION_TOKEN_BYTES = 32; // 256 bits of entropy
const SESSION_TOKEN_HASH_ALGORITHM = "sha256";

function assertToken(token) {
  if (typeof token !== "string" || token.length === 0) {
    throw new TypeError("Session token must be a non-empty string.");
  }
}

function generateSessionToken() {
  // Node's cryptographically secure random generator is the only source of token entropy.
  return crypto.randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
}

function hashSessionToken(token) {
  assertToken(token);
  return crypto.createHash(SESSION_TOKEN_HASH_ALGORITHM).update(token, "utf8").digest("hex");
}

function verifySessionToken(token, storedHash) {
  if (typeof token !== "string" || typeof storedHash !== "string" || storedHash.length === 0) {
    return false;
  }

  let candidateHash;
  try {
    candidateHash = hashSessionToken(token);
  } catch {
    return false;
  }

  const candidate = Buffer.from(candidateHash, "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (candidate.length === 0 || candidate.length !== stored.length) return false;

  return crypto.timingSafeEqual(candidate, stored);
}

module.exports = {
  SESSION_TOKEN_BYTES,
  SESSION_TOKEN_HASH_ALGORITHM,
  generateSessionToken,
  generateToken: generateSessionToken,
  hashSessionToken,
  hashToken: hashSessionToken,
  verifySessionToken,
  verifyToken: verifySessionToken,
};
