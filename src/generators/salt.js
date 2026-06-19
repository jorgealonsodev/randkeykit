/**
 * Salt Generator
 * Generates cryptographic salts of configurable byte size and format.
 *
 * Defaults: 16 bytes, hex format.
 * Range: 8–64 bytes.
 */

import { getRandomBytes } from "../crypto/random.js";
import { encodeHex, encodeBase64 } from "../crypto/encoders.js";

/**
 * Generates a salt.
 * @param {Object} params
 * @param {number} [params.bytes=16] - Size in bytes (8–64)
 * @param {string} [params.format="hex"] - "hex" or "base64"
 * @returns {{ value: string }}
 */
export function generateSalt(params = {}) {
  const bytes = params.bytes ?? 16;
  const format = params.format ?? "hex";

  if (bytes < 8 || bytes > 64) {
    throw new Error(`Salt size must be 8–64 bytes, got ${bytes}`);
  }

  const randomBytes = getRandomBytes(bytes);

  let value;
  if (format === "base64") {
    value = encodeBase64(randomBytes);
  } else if (format === "hex") {
    value = encodeHex(randomBytes);
  } else {
    throw new Error(`Unknown format: ${format}. Use "hex" or "base64".`);
  }

  return { value };
}
