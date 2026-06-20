/**
 * HMAC Key Generator
 * Generates HMAC keys via Web Crypto API (crypto.subtle).
 *
 * Defaults: 256 bits, Base64 format.
 * Minimum: 256 bits.
 *
 * CRITICAL: extractable is set to true — without this, exportKey throws InvalidAccessError.
 */

import { encodeHex, encodeBase64, encodeBase58 } from "../crypto/encoders.js";

/**
 * Generates an HMAC key.
 * @param {Object} params
 * @param {number} [params.bits=256] - Key size in bits (≥256)
 * @param {string} [params.format="base64"] - "hex" or "base64"
 * @returns {Promise<{ value: string }>}
 */
export async function generateHMACKey(params = {}) {
  const bits = params.bits ?? 256;
  const format = params.format ?? "base64";

  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error("Web Crypto API (crypto.subtle) is not available. RandKeyKit requires a secure context (HTTPS or localhost).");
  }

  if (bits < 256) {
    throw new Error(`HMAC key must be at least 256 bits, got ${bits}`);
  }

  if (bits % 8 !== 0) {
    throw new Error(`HMAC key bits must be a multiple of 8, got ${bits}`);
  }

  const key = await globalThis.crypto.subtle.generateKey(
    {
      name: "HMAC",
      hash: { name: "SHA-256" },
      length: bits,
    },
    true,  // extractable: true — MANDATORY for exportKey
    ["sign", "verify"]
  );

  const rawBytes = await globalThis.crypto.subtle.exportKey("raw", key);
  const bytes = new Uint8Array(rawBytes);

  let value;
  if (format === "hex") {
    value = encodeHex(bytes);
  } else if (format === "base64") {
    value = encodeBase64(bytes);
  } else if (format === "base58") {
    value = encodeBase58(bytes);
  } else {
    throw new Error(`Unknown format: ${format}. Use "hex", "base64", or "base58".`);
  }

  return { value };
}
