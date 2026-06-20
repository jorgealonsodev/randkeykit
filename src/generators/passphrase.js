/**
 * Passphrase Generator
 * Generates passphrases from the bundled EFF-style wordlist.
 *
 * Defaults: 5 words, separator "-", lowercase, no number appended.
 * Range: 3–10 words.
 */

import { getRandomInt } from "../crypto/random.js";
import { WORDS } from "../data/words.js";

/**
 * Generates a passphrase.
 * @param {Object} params
 * @param {number} [params.words=5] - Number of words (3–10)
 * @param {string} [params.separator="-"] - Word separator
 * @param {boolean} [params.capitalize=false] - Capitalize each word
 * @param {boolean} [params.appendNumber=false] - Append random digit
 * @param {string} [params.wordlist="eff-large"] - Wordlist selector (placeholder, unused)
 * @returns {{ value: string, entropy: number }}
 */
export function generatePassphrase(params = {}) {
  const wordCount = params.words ?? 5;
  const separator = params.separator ?? "-";
  const capitalize = params.capitalize ?? false;
  const appendNumber = params.appendNumber ?? false;

  if (wordCount < 3 || wordCount > 10) {
    throw new Error(`Passphrase word count must be 3–10, got ${wordCount}`);
  }

  const selected = [];
  for (let i = 0; i < wordCount; i++) {
    const index = getRandomInt(WORDS.length);
    let word = WORDS[index];
    if (capitalize) {
      word = word.charAt(0).toUpperCase() + word.slice(1);
    }
    selected.push(word);
  }

  let value = selected.join(separator);

  if (appendNumber) {
    value += getRandomInt(10).toString();
  }

  const entropy = Math.floor(wordCount * Math.log2(WORDS.length));

  return { value, entropy };
}

/**
 * Estimates passphrase entropy from parameters without generating anything.
 * @param {Object} params — same shape as generatePassphrase
 * @returns {number} entropy in bits (integer)
 */
export function estimateEntropy(params = {}) {
  const wordCount = params.words ?? 5;
  return Math.floor(wordCount * Math.log2(WORDS.length));
}
