import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";

import { generateJwtSecret } from "../../src/crypto/jwt-secret.js";

function installCrypto() {
  const previous = globalThis.crypto;
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    writable: true,
    value: webcrypto,
  });

  return () => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      writable: true,
      value: previous,
    });
  };
}

function decodeBase64Url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

test("JWT secret sizes match HS algorithms", () => {
  const restoreCrypto = installCrypto();

  try {
    assert.equal(decodeBase64Url(generateJwtSecret({ algorithm: "HS256" }).value).length, 32);
    assert.equal(decodeBase64Url(generateJwtSecret({ algorithm: "HS384" }).value).length, 48);
    assert.equal(decodeBase64Url(generateJwtSecret({ algorithm: "HS512" }).value).length, 64);
    assert.equal(decodeBase64Url(generateJwtSecret({ algorithm: "any" }).value).length, 64);
  } finally {
    restoreCrypto();
  }
});

test("JWT secret output is base64url-safe", () => {
  const restoreCrypto = installCrypto();

  try {
    assert.match(generateJwtSecret({ algorithm: "HS256" }).value, /^[A-Za-z0-9_-]+$/);
  } finally {
    restoreCrypto();
  }
});
