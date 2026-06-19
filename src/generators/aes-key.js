/**
 * AES Key Generator
 * Generates AES keys via Web Crypto API (crypto.subtle).
 *
 * Defaults: 256 bits, Base64 format.
 * Allowed sizes: 128, 192, 256 bits.
 *
 * CRITICAL: extractable is set to true — without this, exportKey throws InvalidAccessError.
 */

import { encodeHex, encodeBase64 } from "../crypto/encoders.js";

const VALID_BITS = new Set([128, 192, 256]);

/**
 * Generates an AES key.
 * @param {Object} params
 * @param {number} [params.bits=256] - Key size (128, 192, or 256)
 * @param {string} [params.format="base64"] - "hex" or "base64"
 * @returns {Promise<{ value: string }>}
 */
export async function generateAESKey(params = {}) {
  const bits = params.bits ?? 256;
  const format = params.format ?? "base64";

  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error("Web Crypto API (crypto.subtle) is not available. RandKeyKit requires a secure context (HTTPS or localhost).");
  }

  if (!VALID_BITS.has(bits)) {
    throw new Error(`AES key size must be 128, 192, or 256, got ${bits}`);
  }

  const key = await globalThis.crypto.subtle.generateKey(
    { name: "AES-GCM", length: bits },
    true,  // extractable: true — MANDATORY for exportKey
    ["encrypt"]
  );

  const rawBytes = await globalThis.crypto.subtle.exportKey("raw", key);
  const bytes = new Uint8Array(rawBytes);

  const value = format === "hex"
    ? encodeHex(bytes)
    : encodeBase64(bytes);

  return { value };
}
