/**
 * JWT Secret Generator
 *
 * Generates high-entropy random secrets for signing JWTs with HMAC-SHA algorithms.
 * This produces the signing KEY, not a JWT token itself.
 *
 * Sizes per algorithm:
 * - HS256: 256 bits (32 bytes)
 * - HS384: 384 bits (48 bytes)
 * - HS512: 512 bits (64 bytes)
 * - "any": 512 bits (64 bytes) — safe for all algorithms
 *
 * Output: Base64URL-encoded string.
 */

import { getRandomBytes } from "./random.js";
import { encodeBase64URL } from "./encoders.js";

const ALGORITHM_BYTES = {
  HS256: 32,
  HS384: 48,
  HS512: 64,
  any: 64,
};

/**
 * Generates a JWT signing secret.
 * @param {Object} params
 * @param {string} [params.algorithm="HS256"] - "HS256", "HS384", "HS512", or "any"
 * @returns {{ value: string }}
 */
export function generateJwtSecret(params = {}) {
  const algorithm = params.algorithm ?? "HS256";

  const byteCount = ALGORITHM_BYTES[algorithm];
  if (byteCount === undefined) {
    throw new Error(`Unknown algorithm: ${algorithm}. Use "HS256", "HS384", "HS512", or "any".`);
  }

  const bytes = getRandomBytes(byteCount);
  const value = encodeBase64URL(bytes);

  return { value };
}
