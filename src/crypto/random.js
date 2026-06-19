/**
 * Cryptographically secure random byte and integer generation.
 *
 * All randomness comes from `crypto.getRandomValues` — never `Math.random`.
 * Rejection sampling eliminates modulo bias when generating integers in a range.
 */

const MAX_UINT32 = 4294967296; // 2^32

/**
 * Generates `n` cryptographically secure random bytes.
 * @param {number} n - Number of bytes to generate (1 ≤ n ≤ 65536)
 * @returns {Uint8Array} Array of n random bytes
 * @throws {Error} if crypto.getRandomValues is unavailable
 */
export function getRandomBytes(n) {
  if (!globalThis.crypto || !globalThis.crypto.getRandomValues) {
    throw new Error("Web Crypto API is not available. RandKeyKit requires a secure context (HTTPS or localhost).");
  }

  if (n < 1) {
    throw new Error(`getRandomBytes: n must be ≥ 1, got ${n}`);
  }

  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Generates a cryptographically secure random integer in [0, max-1].
 * Uses rejection sampling to eliminate modulo bias.
 *
 * @param {number} max - Upper bound (exclusive), must be ≥ 1
 * @returns {number} Random integer 0 ≤ value < max
 */
export function getRandomInt(max) {
  if (max < 1) {
    throw new Error(`getRandomInt: max must be ≥ 1, got ${max}`);
  }

  // Simple case: max is 1
  if (max === 1) return 0;

  const buf = new Uint32Array(1);

  // Rejection sampling: only accept values below the largest multiple of max
  // This ensures uniform distribution without modulo bias.
  const limit = Math.floor(MAX_UINT32 / max) * max;

  while (true) {
    globalThis.crypto.getRandomValues(buf);
    const value = buf[0];
    if (value < limit) {
      return value % max;
    }
    // value >= limit → reject and resample
  }
}

/**
 * Picks a random character from a character set string.
 * Uses rejection sampling via getRandomInt for uniform distribution.
 *
 * @param {string} charset - Character set to pick from (non-empty)
 * @returns {string} A single character from the charset
 */
export function pickChar(charset) {
  if (!charset || charset.length === 0) {
    throw new Error("pickChar: charset must be non-empty");
  }
  const index = getRandomInt(charset.length);
  return charset[index];
}
