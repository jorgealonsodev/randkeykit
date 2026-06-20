/**
 * UUID Generation
 *
 * Generates UUIDs per RFC 9562 (draft-ietf-uuidrev-rfc4122bis):
 * - Version 4: 122 random bits, version nibble 4, variant 10
 * - Version 7: 48-bit Unix timestamp (ms) + 74 random bits, version nibble 7, variant 10
 *
 * All randomness from crypto.getRandomValues via getRandomBytes.
 */

import { getRandomBytes } from "./random.js";
import { encodeHex } from "./encoders.js";

/**
 * Formats 16 bytes as a UUID string: 8-4-4-4-12 hex.
 * @param {Uint8Array} bytes - 16 bytes
 * @returns {string} UUID string
 */
function formatUuid(bytes) {
  const hex = encodeHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Generates a UUID version 4 (random).
 * 122 random bits with version=4 and variant=10.
 * @returns {string} UUID v4 string
 */
export function generateUuidV4() {
  const bytes = getRandomBytes(16);

  // Set version nibble to 4 (byte 6, high nibble)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;

  // Set variant bits to 10 (byte 8, high 2 bits)
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return formatUuid(bytes);
}

/**
 * Generates a UUID version 7 (time-ordered).
 * 48-bit Unix timestamp (ms) + 74 random bits, version=7, variant=10.
 * @returns {string} UUID v7 string
 */
export function generateUuidV7() {
  const bytes = getRandomBytes(16);

  // Fill first 6 bytes with Unix timestamp in milliseconds (48 bits, big-endian)
  const timestamp = BigInt(Date.now());
  bytes[0] = Number((timestamp >> 40n) & 0xffn);
  bytes[1] = Number((timestamp >> 32n) & 0xffn);
  bytes[2] = Number((timestamp >> 24n) & 0xffn);
  bytes[3] = Number((timestamp >> 16n) & 0xffn);
  bytes[4] = Number((timestamp >> 8n) & 0xffn);
  bytes[5] = Number(timestamp & 0xffn);

  // Set version nibble to 7 (byte 6, high nibble)
  bytes[6] = (bytes[6] & 0x0f) | 0x70;

  // Set variant bits to 10 (byte 8, high 2 bits)
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return formatUuid(bytes);
}
