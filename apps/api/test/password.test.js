const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { hashPassword, verifyPassword } = require("../src/password");

describe("password utility", () => {
  it("hashes a password and verifies the correct password", async () => {
    const password = "correct horse battery staple";
    const passwordHash = await hashPassword(password);

    assert.equal(typeof passwordHash, "string");
    assert.notEqual(passwordHash, password);
    assert.equal(await verifyPassword(password, passwordHash), true);
  });

  it("rejects an incorrect password", async () => {
    const passwordHash = await hashPassword("expected-password");

    assert.equal(await verifyPassword("wrong-password", passwordHash), false);
  });

  it("rejects malformed or missing hashes", async () => {
    assert.equal(await verifyPassword("any-password", ""), false);
    assert.equal(await verifyPassword("any-password", "not-an-argon2-hash"), false);
  });
});
