/**
 * OTP Auth URI Builder
 *
 * Builds otpauth:// URIs per the Key URI Format:
 * https://github.com/google/google-authenticator/wiki/Key-Uri-Format
 *
 * Format: otpauth://totp/ISSUER:ACCOUNT?secret=BASE32SECRET&issuer=ISSUER&algorithm=SHA1&digits=6&period=30
 */

/**
 * Builds an otpauth:// URI for TOTP.
 * @param {Object} params
 * @param {string} params.secret - Base32-encoded secret (no padding)
 * @param {string} [params.issuer="RandKeyKit"] - Issuer name
 * @param {string} [params.account=""] - Account name (optional)
 * @param {string} [params.algorithm="SHA1"] - Hash algorithm
 * @param {number} [params.digits=6] - OTP digit count
 * @param {number} [params.period=30] - Time step in seconds
 * @returns {string} otpauth:// URI
 */
export function buildOtpauthUri(params) {
  const {
    secret,
    issuer = "RandKeyKit",
    account = "",
    algorithm = "SHA1",
    digits = 6,
    period = 30,
  } = params;

  const label = account
    ? `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`
    : encodeURIComponent(issuer);

  const queryParams = new URLSearchParams({
    secret,
    issuer,
    algorithm,
    digits: String(digits),
    period: String(period),
  });

  return `otpauth://totp/${label}?${queryParams.toString()}`;
}
