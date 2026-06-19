/**
 * TOTP Secret Generator
 * Generates secrets for Time-based One-Time Password (TOTP) authentication.
 *
 * Defaults: 160 bits (20 bytes), output as Base32 without padding.
 * Requirement: ≥160 bits.
 *
 * The secret is encoded per RFC 4648 §6 but with padding stripped,
 * matching the Google Authenticator convention.
 */

import { getRandomBytes } from "../crypto/random.js";
import { encodeBase32 } from "../crypto/encoders.js";

/**
 * Generates a TOTP secret.
 * @param {Object} params
 * @param {number} [params.bits=160] - Secret size in bits (≥160)
 * @returns {{ value: string }}
 */
export function generateTOTPSecret(params = {}) {
  const bits = params.bits ?? 160;

  if (bits < 160) {
    throw new Error(`TOTP secret must be at least 160 bits, got ${bits}`);
  }

  if (bits % 8 !== 0) {
    throw new Error(`TOTP secret bits must be a multiple of 8, got ${bits}`);
  }

  const byteCount = bits / 8;
  const randomBytes = getRandomBytes(byteCount);

  // Encode to Base32 then strip padding for Google Authenticator compatibility
  const padded = encodeBase32(randomBytes);
  const value = padded.replace(/=+$/, "");

  return { value };
}
