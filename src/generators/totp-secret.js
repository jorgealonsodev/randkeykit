/**
 * TOTP Secret Generator
 * Generates secrets for Time-based One-Time Password (TOTP) authentication.
 *
 * Defaults: 160 bits (20 bytes), output as Base32 without padding.
 * Requirement: ≥160 bits.
 *
 * The secret is encoded per RFC 4648 §6 but with padding stripped,
 * matching the Google Authenticator convention.
 *
 * Optionally returns an otpauth:// URI for QR code generation.
 */

import { getRandomBytes } from "../crypto/random.js";
import { encodeBase32 } from "../crypto/encoders.js";
import { buildOtpauthUri } from "../crypto/otpauth.js";

/**
 * Generates a TOTP secret.
 * @param {Object} params
 * @param {number} [params.bits=160] - Secret size in bits (≥160)
 * @param {string} [params.issuer=""] - Issuer name for otpauth URI
 * @param {string} [params.account=""] - Account name for otpauth URI
 * @returns {{ value: string, otpauthUri?: string }}
 */
export function generateTOTPSecret(params = {}) {
  const bits = params.bits ?? 160;
  const issuer = params.issuer ?? "";
  const account = params.account ?? "";

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

  const result = { value };

  // Build otpauth URI if issuer is provided
  if (issuer) {
    result.otpauthUri = buildOtpauthUri({
      secret: value,
      issuer,
      account,
    });
  }

  return result;
}
