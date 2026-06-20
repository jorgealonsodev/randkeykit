import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";

import { generateUuidV4, generateUuidV7 } from "../../src/crypto/uuid.js";
import { generateUuid } from "../../src/generators/uuid.js";

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

test("generateUuidV4 returns RFC 9562 v4 format", () => {
  const restoreCrypto = installCrypto();

  try {
    assert.match(generateUuidV4(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  } finally {
    restoreCrypto();
  }
});

test("generateUuidV7 returns RFC 9562 v7 format", () => {
  const restoreCrypto = installCrypto();

  try {
    assert.match(generateUuidV7(), /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  } finally {
    restoreCrypto();
  }
});

test("generateUuid returns a single UUID per call", () => {
  const restoreCrypto = installCrypto();

  try {
    assert.match(generateUuid({ version: "v4" }).value, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  } finally {
    restoreCrypto();
  }
});

test("generateUuidV7 is lexicographically ordered across increasing timestamps", () => {
  const restoreCrypto = installCrypto();
  const originalNow = Date.now;
  let now = 1_717_171_717_000;

  Date.now = () => now;

  try {
    const first = generateUuidV7();
    now += 1;
    const second = generateUuidV7();

    assert.equal(first < second, true);
  } finally {
    Date.now = originalNow;
    restoreCrypto();
  }
});
