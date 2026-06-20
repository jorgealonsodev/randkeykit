import assert from "node:assert/strict";
import test from "node:test";

import { buildOtpauthUri } from "../../src/crypto/otpauth.js";

test("buildOtpauthUri renders the expected TOTP URI", () => {
  const uri = buildOtpauthUri({
    secret: "JBSWY3DPEHPK3PXP",
    issuer: "RandKeyKit",
    account: "alice",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });

  assert.equal(uri, "otpauth://totp/RandKeyKit:alice?secret=JBSWY3DPEHPK3PXP&issuer=RandKeyKit&algorithm=SHA1&digits=6&period=30");
});

test("buildOtpauthUri URL-encodes issuer and account label segments", () => {
  const uri = buildOtpauthUri({
    secret: "JBSWY3DPEHPK3PXP",
    issuer: "Rand Key Kit",
    account: "alice+demo@example.com",
  });

  assert.match(uri, /^otpauth:\/\/totp\/Rand%20Key%20Kit:alice%2Bdemo%40example\.com\?/);
  assert.match(uri, /issuer=Rand\+Key\+Kit/);
});
