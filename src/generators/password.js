/**
 * Password Generator
 * Generates passwords with configurable character groups and length.
 *
 * Defaults: 20 characters, all groups (uppercase, lowercase, digits, symbols).
 * Range: 8–64 characters.
 * Each enabled character group is guaranteed to appear at least once.
 */

import { getRandomInt } from "../crypto/random.js";

const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SYMBOLS = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";

const AMBIGUOUS_CHARS = new Set(["0", "O", "I", "l", "1"]);

/**
 * Builds the charset from enabled groups, optionally excluding ambiguous chars.
 */
function buildCharset({ uppercase, lowercase, digits, symbols, excludeAmbiguous }) {
  const parts = [];
  if (uppercase) parts.push(UPPERCASE);
  if (lowercase) parts.push(LOWERCASE);
  if (digits) parts.push(DIGITS);
  if (symbols) parts.push(SYMBOLS);

  let charset = parts.join("");

  if (excludeAmbiguous) {
    charset = [...charset].filter((c) => !AMBIGUOUS_CHARS.has(c)).join("");
  }

  return { charset, parts, charsetSize: charset.length };
}

/**
 * Checks that at least one character from each enabled group appears.
 */
function groupsSatisfied(password, parts) {
  return parts.every((group) => {
    const groupSet = new Set(group);
    return [...password].some((c) => groupSet.has(c));
  });
}

/**
 * Generates a password.
 * @param {Object} params
 * @param {number} [params.length=20] - Password length (8–64)
 * @param {boolean} [params.uppercase=true]
 * @param {boolean} [params.lowercase=true]
 * @param {boolean} [params.digits=true]
 * @param {boolean} [params.symbols=true]
 * @param {boolean} [params.excludeAmbiguous=false]
 * @returns {{ value: string, entropy: number }}
 */
export function generatePassword(params = {}) {
  const length = params.length ?? 20;
  const uppercase = params.uppercase ?? true;
  const lowercase = params.lowercase ?? true;
  const digits = params.digits ?? true;
  const symbols = params.symbols ?? true;
  const excludeAmbiguous = params.excludeAmbiguous ?? false;

  if (length < 8 || length > 64) {
    throw new Error(`Password length must be 8–64, got ${length}`);
  }

  if (!uppercase && !lowercase && !digits && !symbols) {
    throw new Error("At least one character group must be enabled.");
  }

  const { charset, parts, charsetSize } = buildCharset({
    uppercase, lowercase, digits, symbols, excludeAmbiguous,
  });

  if (charset.length === 0) {
    throw new Error("Character set is empty after excluding ambiguous characters.");
  }

  // Resample until every enabled group has at least one character
  const maxAttempts = 1000;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset[getRandomInt(charset.length)];
    }

    if (groupsSatisfied(password, parts)) {
      const entropy = Math.floor(length * Math.log2(charsetSize));
      return { value: password, entropy };
    }
  }

  throw new Error("Failed to generate a password satisfying all group requirements. Try a longer length.");
}

/**
 * Estimates password entropy from parameters without generating anything.
 * @param {Object} params — same shape as generatePassword
 * @returns {number} entropy in bits (integer)
 */
export function estimateEntropy(params = {}) {
  const length = params.length ?? 20;
  const { charsetSize } = buildCharset({
    uppercase: params.uppercase ?? true,
    lowercase: params.lowercase ?? true,
    digits: params.digits ?? true,
    symbols: params.symbols ?? true,
    excludeAmbiguous: params.excludeAmbiguous ?? false,
  });

  if (charsetSize === 0) return 0;
  return Math.floor(length * Math.log2(charsetSize));
}
