/**
 * Encoding utilities for converting raw bytes to display/transport formats.
 *
 * All encoders operate on Uint8Array and return strings.
 * - encodeHex: RFC 4648 §8 (lowercase hex)
 * - encodeBase64: RFC 4648 §4 (standard Base64 with padding)
 * - encodeBase64URL: RFC 4648 §5 (URL-safe, no padding)
 * - encodeBase32: RFC 4648 §6 (uppercase A-Z2-7, with padding)
 */

/** RFC 4648 §8 — lowercase hex digits */
const HEX_CHARS = "0123456789abcdef";

/**
 * Encodes bytes to lowercase hexadecimal.
 * @param {Uint8Array} bytes
 * @returns {string} Hex string of length 2 × bytes.length
 */
export function encodeHex(bytes) {
  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    result += HEX_CHARS[b >> 4] + HEX_CHARS[b & 0x0f];
  }
  return result;
}

/**
 * Encodes bytes to standard Base64 with padding (RFC 4648 §4).
 * @param {Uint8Array} bytes
 * @returns {string} Padded Base64 string
 */
export function encodeBase64(bytes) {
  // Convert Uint8Array to binary string for btoa
  const binary = String.fromCharCode(...bytes);
  return globalThis.btoa(binary);
}

/**
 * Encodes bytes to Base64URL with padding stripped (RFC 4648 §5).
 * @param {Uint8Array} bytes
 * @returns {string} URL-safe Base64 string without trailing =
 */
export function encodeBase64URL(bytes) {
  const b64 = encodeBase64(bytes);
  return b64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** RFC 4648 §6 — uppercase Base32 alphabet */
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Encodes bytes to Base32 per RFC 4648 §6 (uppercase, with = padding).
 * @param {Uint8Array} bytes
 * @returns {string} Padded Base32 string
 */
export function encodeBase32(bytes) {
  let buffer = 0;
  let bitsInBuffer = 0;
  let result = "";

  for (let i = 0; i < bytes.length; i++) {
    buffer = (buffer << 8) | bytes[i];
    bitsInBuffer += 8;

    while (bitsInBuffer >= 5) {
      const index = (buffer >> (bitsInBuffer - 5)) & 0x1f;
      result += BASE32_ALPHABET[index];
      bitsInBuffer -= 5;
    }
  }

  // Handle remaining bits (1-4 bits)
  if (bitsInBuffer > 0) {
    const index = (buffer << (5 - bitsInBuffer)) & 0x1f;
    result += BASE32_ALPHABET[index];
  }

  // Pad to multiple of 8
  while (result.length % 8 !== 0) {
    result += "=";
  }

  return result;
}
