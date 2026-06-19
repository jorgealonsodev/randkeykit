/**
 * API Key Generator
 * Generates random API keys of configurable length and format.
 *
 * Defaults: 48 characters, alphanumeric (a-z, A-Z, 0-9).
 * Range: 16–128 characters.
 * Formats: alphanumeric, hex, base64url.
 */

import { getRandomBytes, getRandomInt } from "../crypto/random.js";
import { encodeHex, encodeBase64URL } from "../crypto/encoders.js";

const CHARSET_ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const CHARSET_HEX = "0123456789abcdef";

const FORMATS = {
  alphanumeric: { charset: CHARSET_ALPHANUMERIC, generate: generateCharsetKey },
  hex: { charset: CHARSET_HEX, generate: generateHexKey },
  base64url: { generate: generateBase64URLKey },
};

function generateCharsetKey(charset, length) {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset[getRandomInt(charset.length)];
  }
  return result;
}

function generateHexKey(bytesNeeded) {
  const bytes = getRandomBytes(bytesNeeded);
  // Hex encodes 1 byte → 2 chars; trim to exact length
  return encodeHex(bytes).slice(0, bytesNeeded * 2);
}

function generateBase64URLKey(bytesNeeded) {
  const bytes = getRandomBytes(bytesNeeded);
  return encodeBase64URL(bytes);
}

/**
 * Validates that a prefix string contains only safe ASCII characters
 * (printable, non-whitespace, no control chars).
 */
function validatePrefix(prefix) {
  if (typeof prefix !== "string") return;
  if (!/^[\x21-\x7e]*$/.test(prefix)) {
    throw new Error("Prefix must contain only safe printable ASCII characters (no spaces or control chars).");
  }
}

/**
 * Generates an API key.
 * @param {Object} params
 * @param {number} [params.length=48] - Key length (16–128)
 * @param {string} [params.format="alphanumeric"] - "alphanumeric", "hex", or "base64url"
 * @param {string} [params.prefix=""] - Optional prefix (safe ASCII)
 * @returns {{ value: string, entropy: number }}
 */
export function generateAPIKey(params = {}) {
  const length = params.length ?? 48;
  const format = params.format ?? "alphanumeric";
  const prefix = params.prefix ?? "";

  if (length < 16 || length > 128) {
    throw new Error(`API key length must be 16–128, got ${length}`);
  }

  validatePrefix(prefix);

  const fmt = FORMATS[format];
  if (!fmt) {
    throw new Error(`Unknown format: ${format}. Use "alphanumeric", "hex", or "base64url".`);
  }

  let value;
  let charsetSize;

  if (format === "alphanumeric") {
    value = fmt.generate(fmt.charset, length);
    charsetSize = fmt.charset.length;
  } else if (format === "hex") {
    const bytesNeeded = Math.ceil(length / 2);
    value = generateHexKey(bytesNeeded).slice(0, length);
    charsetSize = 16;
  } else {
    // base64url — generate exact byte count, may produce longer output
    const bytesNeeded = Math.ceil((length * 6) / 8);
    value = generateBase64URLKey(bytesNeeded).slice(0, length);
    charsetSize = 64;
  }

  const fullValue = prefix + value;
  const entropy = Math.floor(length * Math.log2(charsetSize));

  return { value: fullValue, entropy };
}

/**
 * Estimates API key entropy from parameters without generating anything.
 * @param {Object} params — same shape as generateAPIKey
 * @returns {number} entropy in bits (integer)
 */
export function estimateEntropy(params = {}) {
  const length = params.length ?? 48;
  const format = params.format ?? "alphanumeric";

  let charsetSize;
  if (format === "alphanumeric") charsetSize = 62;
  else if (format === "hex") charsetSize = 16;
  else charsetSize = 64; // base64url

  return Math.floor(length * Math.log2(charsetSize));
}
