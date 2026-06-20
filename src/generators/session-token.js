/**
 * Session Token Generator
 * Generates cryptographically random session tokens.
 *
 * Defaults: 32 bytes, Base64URL format.
 * Range: 16–64 bytes.
 */

import { getRandomBytes } from "../crypto/random.js";
import { encodeHex, encodeBase64URL, encodeBase58 } from "../crypto/encoders.js";

/**
 * Generates a session token.
 * @param {Object} params
 * @param {number} [params.bytes=32] - Size in bytes (16–64)
 * @param {string} [params.format="base64url"] - "hex" or "base64url"
 * @returns {{ value: string }}
 */
export function generateSessionToken(params = {}) {
  const bytes = params.bytes ?? 32;
  const format = params.format ?? "base64url";

  if (bytes < 16 || bytes > 64) {
    throw new Error(`Session token size must be 16–64 bytes, got ${bytes}`);
  }

  const randomBytes = getRandomBytes(bytes);

  let value;
  if (format === "hex") {
    value = encodeHex(randomBytes);
  } else if (format === "base64url") {
    value = encodeBase64URL(randomBytes);
  } else if (format === "base58") {
    value = encodeBase58(randomBytes);
  } else {
    throw new Error(`Unknown format: ${format}. Use "hex", "base64url", or "base58".`);
  }

  return { value };
}
