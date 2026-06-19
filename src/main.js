/**
 * RandKeyKit — Main Entry Point
 *
 * Boot sequence:
 * 1. Check crypto.subtle availability (secure context guard)
 * 2. Import all 9 generators
 * 3. Create generator cards with controls
 * 4. Append cards to the DOM
 */

import { createGeneratorCard } from "./ui/card.js";
import { copyToClipboard } from "./ui/clipboard.js";
import { generateAPIKey } from "./generators/api-key.js";
import { generatePassword } from "./generators/password.js";
import { generatePassphrase } from "./generators/passphrase.js";
import { generateSalt } from "./generators/salt.js";
import { generateAESKey } from "./generators/aes-key.js";
import { generateHMACKey } from "./generators/hmac-key.js";
import { generateSessionToken } from "./generators/session-token.js";
import { generateCSRFToken } from "./generators/csrf-token.js";
import { generateTOTPSecret } from "./generators/totp-secret.js";

/**
 * Checks that the Web Crypto API is available.
 * crypto.subtle is undefined in insecure contexts (plain HTTP, file://).
 * This is a hard requirement — we fail-loud, not silently.
 */
function checkSecureContext() {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    const app = document.getElementById("app");
    if (!app) return false;

    const banner = document.createElement("div");
    banner.className = "error-banner";
    banner.setAttribute("role", "alert");
    banner.innerHTML = `
      <strong>Secure context required</strong><br>
      Web Crypto API (crypto.subtle) is not available.<br>
      RandKeyKit requires HTTPS or localhost to generate cryptographic keys.
    `;
    app.prepend(banner);

    // Disable all Generate buttons that may already exist
    document.querySelectorAll(".btn-primary").forEach((btn) => {
      btn.disabled = true;
      btn.textContent = "Unavailable";
    });

    return false;
  }
  return true;
}

/**
 * Card definitions for all 9 generators.
 * Order per PRD §5.1: API Key, Password, Passphrase, Salt, AES Key, HMAC Key,
 *   Session Token, CSRF Token, TOTP Secret.
 */
const CARD_CONFIGS = [
  {
    id: "api-key",
    title: "API Key",
    description: "Random string for authenticating API clients. Use 48+ characters in production.",
    generator: generateAPIKey,
    defaults: { length: 48, format: "alphanumeric", prefix: "" },
    controls: [
      { type: "range", label: "Length", param: "length", min: 16, max: 128, default: 48 },
      { type: "select", label: "Format", param: "format", default: "alphanumeric", options: [
        { value: "alphanumeric", label: "Alphanumeric" },
        { value: "hex", label: "Hex" },
        { value: "base64url", label: "Base64URL" },
      ]},
      { type: "text", label: "Prefix", param: "prefix", default: "", placeholder: "Optional prefix (safe ASCII)" },
    ],
    showEntropy: true,
  },
  {
    id: "password",
    title: "Password",
    description: "Strong password with configurable character groups. At least 12 characters recommended.",
    generator: generatePassword,
    defaults: { length: 20, uppercase: true, lowercase: true, digits: true, symbols: true, excludeAmbiguous: false },
    controls: [
      { type: "range", label: "Length", param: "length", min: 8, max: 64, default: 20 },
      { type: "checkbox", label: "Uppercase", param: "uppercase", default: true },
      { type: "checkbox", label: "Lowercase", param: "lowercase", default: true },
      { type: "checkbox", label: "Digits", param: "digits", default: true },
      { type: "checkbox", label: "Symbols", param: "symbols", default: true },
      { type: "checkbox", label: "Exclude ambiguous (0 O I l)", param: "excludeAmbiguous", default: false },
    ],
    showEntropy: true,
  },
  {
    id: "passphrase",
    title: "Passphrase",
    description: "Memorable passphrase from random dictionary words. Easier to type and remember than passwords.",
    generator: generatePassphrase,
    defaults: { words: 5, separator: "-", capitalize: false, appendNumber: false },
    controls: [
      { type: "range", label: "Words", param: "words", min: 3, max: 10, default: 5 },
      { type: "text", label: "Separator", param: "separator", default: "-" },
      { type: "checkbox", label: "Capitalize", param: "capitalize", default: false },
      { type: "checkbox", label: "Append number", param: "appendNumber", default: false },
    ],
    showEntropy: true,
  },
  {
    id: "salt",
    title: "Salt",
    description: "Random bytes for password hashing. Use at least 16 bytes (128 bits) for bcrypt/scrypt/argon2.",
    generator: generateSalt,
    defaults: { bytes: 16, format: "hex" },
    controls: [
      { type: "range", label: "Bytes", param: "bytes", min: 8, max: 64, default: 16 },
      { type: "select", label: "Format", param: "format", default: "hex", options: [
        { value: "hex", label: "Hex" },
        { value: "base64", label: "Base64" },
      ]},
    ],
    showEntropy: false,
  },
  {
    id: "aes-key",
    title: "AES Key",
    description: "Symmetric encryption key for AES-GCM. 256-bit recommended for long-term security.",
    generator: generateAESKey,
    defaults: { bits: 256, format: "base64" },
    controls: [
      { type: "select", label: "Key size", param: "bits", default: 256, options: [
        { value: 128, label: "128-bit" },
        { value: 192, label: "192-bit" },
        { value: 256, label: "256-bit" },
      ]},
      { type: "select", label: "Format", param: "format", default: "base64", options: [
        { value: "hex", label: "Hex" },
        { value: "base64", label: "Base64" },
      ]},
    ],
    showEntropy: false,
  },
  {
    id: "hmac-key",
    title: "HMAC Key",
    description: "Secret key for HMAC-SHA-256 message authentication. Use at least 256 bits.",
    generator: generateHMACKey,
    defaults: { bits: 256, format: "base64" },
    controls: [
      { type: "select", label: "Key size", param: "bits", default: 256, options: [
        { value: 256, label: "256-bit" },
        { value: 384, label: "384-bit" },
        { value: 512, label: "512-bit" },
      ]},
      { type: "select", label: "Format", param: "format", default: "base64", options: [
        { value: "hex", label: "Hex" },
        { value: "base64", label: "Base64" },
      ]},
    ],
    showEntropy: false,
  },
  {
    id: "session-token",
    title: "Session Token",
    description: "Opaque token for session management. Use 32+ bytes and always send over HTTPS.",
    generator: generateSessionToken,
    defaults: { bytes: 32, format: "base64url" },
    controls: [
      { type: "range", label: "Bytes", param: "bytes", min: 16, max: 64, default: 32 },
      { type: "select", label: "Format", param: "format", default: "base64url", options: [
        { value: "hex", label: "Hex" },
        { value: "base64url", label: "Base64URL" },
      ]},
    ],
    showEntropy: false,
  },
  {
    id: "csrf-token",
    title: "CSRF Token",
    description: "Anti-CSRF token for form submissions. Generate per-session and validate server-side.",
    generator: generateCSRFToken,
    defaults: { bytes: 32, format: "base64url" },
    controls: [
      { type: "range", label: "Bytes", param: "bytes", min: 16, max: 64, default: 32 },
      { type: "select", label: "Format", param: "format", default: "base64url", options: [
        { value: "hex", label: "Hex" },
        { value: "base64url", label: "Base64URL" },
      ]},
    ],
    showEntropy: false,
  },
  {
    id: "totp-secret",
    title: "TOTP Secret",
    description: "Base32-encoded secret for Time-based One-Time Passwords (Google Authenticator compatible).",
    generator: generateTOTPSecret,
    defaults: { bits: 160 },
    controls: [
      { type: "select", label: "Secret size", param: "bits", default: 160, options: [
        { value: 160, label: "160-bit (20B)" },
        { value: 256, label: "256-bit (32B)" },
        { value: 320, label: "320-bit (40B)" },
      ]},
    ],
    showEntropy: false,
  },
];

// ---- Boot sequence ----

function boot() {
  const app = document.getElementById("app");
  if (!app) {
    console.error("RandKeyKit: #app container not found.");
    return;
  }

  // Secure context check — must come before card creation
  // so we don't render cards that will fail
  const secure = checkSecureContext();

  // Create all cards
  CARD_CONFIGS.forEach((config) => {
    const card = createGeneratorCard(config, copyToClipboard);
    app.appendChild(card);
  });

  // If not in a secure context, disable all Generate buttons
  if (!secure) {
    document.querySelectorAll(".btn-primary").forEach((btn) => {
      btn.disabled = true;
      btn.textContent = "Unavailable";
    });
  }
}

// Run on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
