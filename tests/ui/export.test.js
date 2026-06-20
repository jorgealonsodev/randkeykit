import assert from "node:assert/strict";
import test from "node:test";

import { buildCsv, buildEnv, buildText, toEnvKeyBase } from "../../src/ui/export.js";

test("buildText joins values with newlines", () => {
  assert.equal(buildText(["a", "b", "c"]), "a\nb\nc");
});

test("buildCsv adds header and escapes commas, quotes, and newlines", () => {
  assert.equal(
    buildCsv(["plain", 'needs,"quotes"', "line1\nline2"]),
    'index,value\n1,plain\n2,"needs,""quotes"""\n3,"line1\nline2"',
  );
});

test("toEnvKeyBase derives uppercase snake case", () => {
  assert.equal(toEnvKeyBase("api-key"), "API_KEY");
  assert.equal(toEnvKeyBase("totp secret"), "TOTP_SECRET");
});

test("buildEnv uses bare key for single output and indexed keys for batch", () => {
  assert.equal(buildEnv(["abc123"], "api-key"), "API_KEY=abc123");
  assert.equal(buildEnv(["a", "b"], "jwt-secret"), "JWT_SECRET_1=a\nJWT_SECRET_2=b");
});

test("buildEnv quotes whitespace-bearing values", () => {
  assert.equal(buildEnv(["two words"], "passphrase"), 'PASSPHRASE="two words"');
});
