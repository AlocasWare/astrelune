const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { generateSessionToken, hashSessionToken, verifySessionToken } = require("../src/session");

describe("session utility", () => {
  it("generates a 256-bit token from the secure random generator", () => {
    const token = generateSessionToken();

    assert.equal(typeof token, "string");
    assert.ok(token.length >= 43);
    assert.notEqual(token, generateSessionToken());
  });

  it("hashes tokens deterministically and does not store the raw token", () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);

    assert.equal(hash, hashSessionToken(token));
    assert.notEqual(hash, token);
    assert.equal(hash.length, 64);
  });

  it("verifies only the matching token", () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);

    assert.equal(verifySessionToken(token, hash), true);
    assert.equal(verifySessionToken("wrong-token", hash), false);
    assert.equal(verifySessionToken(token, "invalid-hash"), false);
  });

  it("does not derive tokens from predictable inputs", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateSessionToken()));
    assert.equal(tokens.size, 100);
  });
});
