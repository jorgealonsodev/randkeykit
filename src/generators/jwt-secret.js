/**
 * JWT Secret Generator (Card)
 *
 * Generates high-entropy signing secrets for HMAC-SHA JWT algorithms.
 * Delegates to the crypto module for actual generation.
 */

import { generateJwtSecret as cryptoGenerateJwtSecret } from "../crypto/jwt-secret.js";

/**
 * Generates a JWT signing secret.
 * @param {Object} params
 * @param {string} [params.algorithm="HS256"] - "HS256", "HS384", "HS512", or "any"
 * @returns {{ value: string }}
 */
export function generateJwtSecretCard(params = {}) {
  return cryptoGenerateJwtSecret(params);
}
