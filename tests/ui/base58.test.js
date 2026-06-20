import assert from "node:assert/strict";
import test from "node:test";

import { decodeBase58, encodeBase58 } from "../../src/crypto/encoders.js";

test("encodeBase58 round-trips arbitrary bytes", () => {
  const bytes = new Uint8Array([0, 1, 2, 3, 254, 255]);
  const encoded = encodeBase58(bytes);
  const decoded = decodeBase58(encoded);

  assert.deepEqual([...decoded], [...bytes]);
});

test("encodeBase58 preserves leading zero bytes as leading ones", () => {
  const bytes = new Uint8Array([0, 0, 1]);

  assert.equal(encodeBase58(bytes), "112");
});

test("decodeBase58 rejects invalid characters", () => {
  assert.throws(() => decodeBase58("0OIl"), /Invalid Base58 character/);
});
