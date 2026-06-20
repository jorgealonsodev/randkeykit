import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { webcrypto } from "node:crypto";

import { arrayBufferToPem } from "../../src/crypto/pem.js";
import { generateRSAKeypair } from "../../src/generators/rsa-keypair.js";
import { generateECDSAKeypair } from "../../src/generators/ecdsa-keypair.js";
import { buildHashReport, writeBuildHashFile } from "../../scripts/build-hash.mjs";
import { WORDS } from "../../src/data/words.js";

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

test("arrayBufferToPem formats standard PEM boundaries", () => {
  const pem = arrayBufferToPem(new Uint8Array([1, 2, 3, 4]).buffer, "PUBLIC KEY");
  assert.match(pem, /^-----BEGIN PUBLIC KEY-----/);
  assert.match(pem, /-----END PUBLIC KEY-----$/);
});

test("RSA and ECDSA generators return PEM-shaped keypairs", async () => {
  const restoreCrypto = installCrypto();

  try {
    const rsa = await generateRSAKeypair({ algorithm: "RSA-OAEP", bits: 2048 });
    const ecdsa = await generateECDSAKeypair({ curve: "P-256" });

    for (const result of [rsa, ecdsa]) {
      assert.match(result.publicKeyPem, /^-----BEGIN PUBLIC KEY-----/);
      assert.match(result.privateKeyPem, /^-----BEGIN PRIVATE KEY-----/);
      assert.equal(result.outputs.length, 2);
    }
  } finally {
    restoreCrypto();
  }
});

test("build-hash report writes manifest metadata and file hashes", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "randkeykit-build-hash-"));

  try {
    mkdirSync(join(rootDir, "src"), { recursive: true });
    mkdirSync(join(rootDir, "assets"), { recursive: true });
    writeFileSync(join(rootDir, "index.html"), "<html></html>");
    writeFileSync(join(rootDir, "docs.html"), "docs");
    writeFileSync(join(rootDir, "verify.html"), "verify");
    writeFileSync(join(rootDir, "manifest.webmanifest"), "{}");
    writeFileSync(join(rootDir, "sw.js"), "self.addEventListener('install', ()=>{});");
    writeFileSync(join(rootDir, "assets", "tailwind.css"), "body{}");
    writeFileSync(join(rootDir, "src", "main.js"), "export const ok = true;");

    const report = buildHashReport({
      rootDir,
      fileList: ["index.html", "docs.html", "verify.html", "manifest.webmanifest", "sw.js", "assets/tailwind.css", "src/main.js"],
      buildDate: "2026-06-20T00:00:00.000Z",
      gitCommit: "abc123",
    });

    assert.match(report, /build-date: 2026-06-20T00:00:00.000Z/);
    assert.match(report, /git-commit: abc123/);
    assert.match(report, /aggregate-sha256:/);
    assert.match(report, /index.html/);

    writeBuildHashFile({
      rootDir,
      outputPath: join(rootDir, "build-hash.txt"),
      fileList: ["index.html", "docs.html", "verify.html", "manifest.webmanifest", "sw.js", "assets/tailwind.css", "src/main.js"],
      buildDate: "2026-06-20T00:00:00.000Z",
      gitCommit: "abc123",
    });

    const written = readFileSync(join(rootDir, "build-hash.txt"), "utf8");
    assert.equal(written, report);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("bundled passphrase wordlist contains the full EFF large list", () => {
  assert.ok(WORDS.length >= 7776);
});

test("service worker cache list is static-shell only", () => {
  const swSource = readFileSync(new URL("../../sw.js", import.meta.url), "utf8");
  const blockMatch = swSource.match(/const STATIC_ASSETS = \[(.*?)\];/s);
  assert.ok(blockMatch, "STATIC_ASSETS block should exist");

  const assetPaths = [...blockMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  assert.ok(assetPaths.includes("/index.html"));
  assert.ok(assetPaths.includes("/src/main.js"));
  assert.ok(assetPaths.includes("/assets/tailwind.css"));
  assert.ok(assetPaths.every((assetPath) => assetPath.startsWith("/")));
  assert.equal(swSource.includes("localStorage"), false);
  assert.equal(swSource.includes("indexedDB"), false);
  assert.equal(swSource.includes("sessionStorage"), false);
});
