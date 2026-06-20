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

/** Base58 Bitcoin/IPFS alphabet (no 0, O, I, l) */
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Encodes bytes to Base58 (Bitcoin/IPFS alphabet).
 * Leading zero bytes map to leading '1' characters.
 * @param {Uint8Array} bytes
 * @returns {string} Base58-encoded string
 */
export function encodeBase58(bytes) {
  if (bytes.length === 0) return "";

  // Count leading zeros
  let leadingZeros = 0;
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    leadingZeros++;
  }

  // Convert to BigInt for division
  let num = 0n;
  for (let i = 0; i < bytes.length; i++) {
    num = num * 256n + BigInt(bytes[i]);
  }

  // Divide by 58 repeatedly
  let result = "";
  while (num > 0n) {
    const remainder = Number(num % 58n);
    num = num / 58n;
    result = BASE58_ALPHABET[remainder] + result;
  }

  // Prepend '1' for each leading zero byte
  return "1".repeat(leadingZeros) + result;
}

/**
 * Decodes a Base58 string back to Uint8Array.
 * Leading '1' characters map to leading 0x00 bytes.
 * @param {string} str - Base58-encoded string
 * @returns {Uint8Array} Decoded bytes
 * @throws {Error} if string contains invalid characters
 */
export function decodeBase58(str) {
  if (str.length === 0) return new Uint8Array(0);

  // Count leading '1's
  let leadingOnes = 0;
  for (let i = 0; i < str.length && str[i] === "1"; i++) {
    leadingOnes++;
  }

  // Convert from Base58 to BigInt
  let num = 0n;
  for (let i = 0; i < str.length; i++) {
    const index = BASE58_ALPHABET.indexOf(str[i]);
    if (index === -1) {
      throw new Error(`Invalid Base58 character: '${str[i]}' at position ${i}`);
    }
    num = num * 58n + BigInt(index);
  }

  // Convert BigInt to bytes
  const hexStr = num === 0n ? "" : num.toString(16);
  const paddedHex = hexStr.length % 2 ? "0" + hexStr : hexStr;
  const dataBytes = [];
  for (let i = 0; i < paddedHex.length; i += 2) {
    dataBytes.push(parseInt(paddedHex.slice(i, i + 2), 16));
  }

  // Prepend leading zero bytes
  const result = new Uint8Array(leadingOnes + dataBytes.length);
  for (let i = 0; i < dataBytes.length; i++) {
    result[leadingOnes + i] = dataBytes[i];
  }

  return result;
}
