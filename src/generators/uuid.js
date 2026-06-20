/**
 * UUID Generator
 *
 * Generates UUID v4 (random) or v7 (time-ordered) per RFC 9562.
 * Returns a single UUID per call. Batching is handled by the card layer.
 */

import { generateUuidV4, generateUuidV7 } from "../crypto/uuid.js";

/**
 * Generates a single UUID.
 * @param {Object} params
 * @param {string} [params.version="v4"] - "v4" or "v7"
 * @returns {{ value: string }}
 */
export function generateUuid(params = {}) {
  const version = params.version ?? "v4";

  const generator = version === "v7" ? generateUuidV7 : generateUuidV4;
  return { value: generator() };
}
