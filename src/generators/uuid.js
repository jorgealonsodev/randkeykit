/**
 * UUID Generator
 *
 * Generates UUID v4 (random) or v7 (time-ordered) per RFC 9562.
 * Supports batch generation (1–10 UUIDs at once).
 */

import { generateUuidV4, generateUuidV7 } from "../crypto/uuid.js";

/**
 * Generates one or more UUIDs.
 * @param {Object} params
 * @param {string} [params.version="v4"] - "v4" or "v7"
 * @param {number} [params.count=1] - Number of UUIDs (1–10)
 * @returns {{ value: string }}
 */
export function generateUuid(params = {}) {
  const version = params.version ?? "v4";
  const count = params.count ?? 1;

  if (count < 1 || count > 10) {
    throw new Error(`UUID count must be 1–10, got ${count}`);
  }

  const generator = version === "v7" ? generateUuidV7 : generateUuidV4;
  const uuids = [];
  for (let i = 0; i < count; i++) {
    uuids.push(generator());
  }

  return { value: uuids.join("\n") };
}
