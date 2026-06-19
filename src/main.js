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
import { createEntropyMap } from "./ui/entropy-map.js";
import { getRefreshAllToastMessage } from "./ui/refresh.js";
import { generateAPIKey, estimateEntropy as estimateAPIKeyEntropy } from "./generators/api-key.js";
import { generatePassword, estimateEntropy as estimatePasswordEntropy } from "./generators/password.js";
import { generatePassphrase, estimateEntropy as estimatePassphraseEntropy } from "./generators/passphrase.js";
import { generateSalt } from "./generators/salt.js";
import { generateAESKey } from "./generators/aes-key.js";
import { generateHMACKey } from "./generators/hmac-key.js";
import { generateSessionToken } from "./generators/session-token.js";
import { generateCSRFToken } from "./generators/csrf-token.js";
import { generateTOTPSecret } from "./generators/totp-secret.js";

export const GENERATE_PLACEHOLDER = "Generate a new value to preview it here.";
const REFRESH_ALL_DEFAULT_LABEL = `<span class="material-symbols-outlined">refresh</span> Refresh All`;
const REFRESH_ALL_LOADING_LABEL = `<span class="material-symbols-outlined">progress_activity</span> Refreshing…`;

/**
 * Checks that the Web Crypto API is available.
 * crypto.subtle is undefined in insecure contexts (plain HTTP, file://).
 * This is a hard requirement — we fail-loud, not silently.
 */
export function isSecureContextAvailable() {
  return Boolean(globalThis.crypto && globalThis.crypto.subtle);
}

export function applyInsecureContextState({ bannerHost, cards, placeholder = GENERATE_PLACEHOLDER }) {
  if (bannerHost) {
    bannerHost.className = "mt-6 rounded-xl border border-error-container bg-error-container p-5 text-on-error-container";
    bannerHost.hidden = false;
    bannerHost.setAttribute("role", "alert");
    bannerHost.innerHTML = `
      <div class="flex items-start gap-4">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-error-container bg-error-container">
          <span class="material-symbols-outlined text-[22px] text-on-error-container">warning</span>
        </div>
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.2em] text-on-error-container">Secure context required</p>
          <h2 class="mt-2 font-display text-2xl font-semibold text-on-error-container">Web Crypto is unavailable in this context.</h2>
          <p class="mt-3 max-w-3xl text-sm leading-7 text-on-error-container">RandKeyKit requires HTTPS or localhost to access crypto.subtle and generate cryptographic keys safely. Open this app behind TLS or on localhost and try again.</p>
        </div>
      </div>
    `;
  }

  cards.forEach((card) => {
    const output = card.querySelector("output");
    const button = card.querySelector('[data-action="generate"]') || card.querySelector("button");
    if (output) output.textContent = placeholder;
    if (button) button.disabled = true;
  });
}

function checkSecureContext() {
  if (isSecureContextAvailable()) return true;

  const bannerHost = document.getElementById("secure-context-banner");
  applyInsecureContextState({ bannerHost, cards: [] });
  return false;
}

export function createToastController(toast) {
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("opacity-0", "translate-y-6");
    toast.classList.add("opacity-100", "translate-y-0");
    clearTimeout(showToast.timeoutId);
    showToast.timeoutId = setTimeout(() => {
      toast.classList.add("opacity-0", "translate-y-6");
      toast.classList.remove("opacity-100", "translate-y-0");
    }, 1800);
  }

  showToast.timeoutId = 0;
  return showToast;
}

export function renderCards({ app, configs, createCard, copyValue, showToast, secure, onGenerate }) {
  const cards = configs.map((config) => createCard(config, copyValue, showToast, onGenerate));

  cards.forEach((card) => {
    app.appendChild(card);
  });

  if (!secure) {
    const bannerHost = document.getElementById("secure-context-banner");
    applyInsecureContextState({ bannerHost, cards });
  }

  return cards;
}

/**
 * Updates the honest "Secure context" indicator in the System Resources panel.
 * Runs from the same-origin module (CSP-safe — no inline script). Null-guards so
 * it is a no-op when the panel elements are absent (e.g. unit-test DOM shells).
 */
export function updateSecureContextStatus(secure) {
  const label = document.getElementById("secure-ctx-label");
  const bar = document.getElementById("secure-ctx-bar");
  if (!label || !bar) return;

  bar.classList.remove("w-0");
  bar.classList.add("w-full");

  if (secure) {
    label.textContent = "Active";
    label.className = "font-bold text-tertiary";
    bar.classList.remove("bg-error");
    bar.classList.add("bg-tertiary");
  } else {
    label.textContent = "Unavailable";
    label.className = "font-bold text-error";
    bar.classList.remove("bg-tertiary");
    bar.classList.add("bg-error");
  }
}

/**
 * Wires the sidebar category filters to the generator grid.
 * Each filter button carries a data-filter value ("all" or a card category);
 * clicking it shows only matching cards and marks the button active.
 * CSP-safe (module code) and null-guarded for test DOM shells.
 */
export function wireSidebarFilters({ container, cards }) {
  if (!container) return;

  const buttons = [...container.querySelectorAll("[data-filter]")];
  if (buttons.length === 0) return;

  function setActiveButton(activeButton) {
    buttons.forEach((button) => {
      const isActive = button === activeButton;
      button.classList.toggle("bg-primary-container", isActive);
      button.classList.toggle("text-on-primary-container", isActive);
      button.classList.toggle("font-bold", isActive);
      button.classList.toggle("text-secondary", !isActive);
      button.classList.toggle("hover:bg-surface-container-high", !isActive);
    });
  }

  function applyFilter(filter) {
    cards.forEach((card) => {
      const category = card.dataset.category;
      const show = filter === "all" || category === filter;
      // Inline display wins over the card's `flex` utility class; the `hidden`
      // attribute alone is overridden by Tailwind's `.flex { display:flex }`.
      card.hidden = !show;
      card.style.display = show ? "" : "none";
    });
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveButton(button);
      applyFilter(button.dataset.filter);
    });
  });
}

export function wireRefreshAll({ refreshAllButton, cards, secure, showToast }) {
  if (!refreshAllButton) return;

  refreshAllButton.addEventListener("click", async () => {
    if (!secure) {
      showToast("Refresh unavailable without HTTPS or localhost.");
      return;
    }

    refreshAllButton.disabled = true;
    refreshAllButton.innerHTML = REFRESH_ALL_LOADING_LABEL;
    try {
      const results = await Promise.allSettled(cards.map((card) => card.generateValue()));
      const failures = results.filter((result) => result.status === "rejected").length;
      showToast(getRefreshAllToastMessage(cards.length, failures));
    } finally {
      refreshAllButton.disabled = false;
      refreshAllButton.innerHTML = REFRESH_ALL_DEFAULT_LABEL;
    }
  });
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
    icon: "api",
    category: "tokens",
    description: "Random string for authenticating API clients. Use 48+ characters in production.",
    generator: generateAPIKey,
    defaults: { length: 48, format: "alphanumeric", prefix: "" },
    controls: [
      { type: "range", label: "Length", param: "length", min: 16, max: 128, default: 48, hint: "characters" },
      { type: "select", label: "Format", param: "format", default: "alphanumeric", options: [
        { value: "alphanumeric", label: "Alphanumeric" },
        { value: "hex", label: "Hex" },
        { value: "base64url", label: "Base64URL" },
      ]},
      { type: "text", label: "Prefix", param: "prefix", default: "", placeholder: "Optional prefix (safe ASCII)" },
    ],
    showEntropy: true,
    entropy: (params) => estimateAPIKeyEntropy(params),
  },
  {
    id: "password",
    title: "Password",
    icon: "password",
    category: "passcodes",
    description: "Strong password with configurable character groups. At least 12 characters recommended.",
    generator: generatePassword,
    defaults: { length: 20, uppercase: true, lowercase: true, digits: true, symbols: true, excludeAmbiguous: false },
    controls: [
      { type: "range", label: "Length", param: "length", min: 8, max: 64, default: 20, hint: "characters" },
      { type: "checkbox-group", label: "Character groups", options: [
        { label: "Uppercase", param: "uppercase", default: true },
        { label: "Lowercase", param: "lowercase", default: true },
        { label: "Digits", param: "digits", default: true },
        { label: "Symbols", param: "symbols", default: true },
      ]},
      { type: "checkbox", label: "Exclude ambiguous", param: "excludeAmbiguous", default: false, description: "Remove 0, O, I, l, and 1 from the active charset." },
    ],
    showEntropy: true,
    entropy: (params) => estimatePasswordEntropy(params),
  },
  {
    id: "passphrase",
    title: "Passphrase",
    icon: "chat_bubble_outline",
    category: "passcodes",
    description: "Memorable passphrase from random dictionary words. Easier to type and remember than passwords.",
    generator: generatePassphrase,
    defaults: { words: 5, separator: "-", capitalize: false, appendNumber: false },
    controls: [
      { type: "range", label: "Words", param: "words", min: 3, max: 10, default: 5, hint: "count" },
      { type: "text", label: "Separator", param: "separator", default: "-" },
      { type: "checkbox", label: "Capitalize", param: "capitalize", default: false },
      { type: "checkbox", label: "Append number", param: "appendNumber", default: false },
    ],
    showEntropy: true,
    entropy: (params) => estimatePassphraseEntropy(params),
  },
  {
    id: "salt",
    title: "Salt",
    icon: "grain",
    category: "keys",
    description: "Random bytes for password hashing. Use at least 16 bytes (128 bits) for bcrypt/scrypt/argon2.",
    generator: generateSalt,
    defaults: { bytes: 16, format: "hex" },
    controls: [
      { type: "range", label: "Bytes", param: "bytes", min: 8, max: 64, default: 16, hint: "size" },
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
    icon: "security",
    category: "keys",
    description: "Symmetric encryption key for AES-GCM. 256-bit recommended for long-term security.",
    generator: generateAESKey,
    defaults: { bits: 256, format: "base64" },
    controls: [
      { type: "select", label: "Key size", param: "bits", default: 256, parse: Number, options: [
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
    icon: "key_visualizer",
    category: "keys",
    description: "Secret key for HMAC-SHA-256 message authentication. Use at least 256 bits.",
    generator: generateHMACKey,
    defaults: { bits: 256, format: "base64" },
    controls: [
      { type: "select", label: "Key size", param: "bits", default: 256, parse: Number, options: [
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
    icon: "timer",
    category: "tokens",
    description: "Opaque token for session management. Use 32+ bytes and always send over HTTPS.",
    generator: generateSessionToken,
    defaults: { bytes: 32, format: "base64url" },
    controls: [
      { type: "range", label: "Bytes", param: "bytes", min: 16, max: 64, default: 32, hint: "size" },
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
    icon: "shield",
    category: "tokens",
    description: "Anti-CSRF token for form submissions. Generate per-session and validate server-side.",
    generator: generateCSRFToken,
    defaults: { bytes: 32, format: "base64url" },
    controls: [
      { type: "range", label: "Bytes", param: "bytes", min: 16, max: 64, default: 32, hint: "size" },
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
    icon: "cell_tower",
    category: "passcodes",
    description: "Base32-encoded secret for Time-based One-Time Passwords (Google Authenticator compatible).",
    generator: generateTOTPSecret,
    defaults: { bits: 160 },
    controls: [
      { type: "select", label: "Secret size", param: "bits", default: 160, parse: Number, options: [
        { value: 160, label: "160-bit (20B)" },
        { value: 256, label: "256-bit (32B)" },
        { value: 320, label: "320-bit (40B)" },
      ]},
    ],
    showEntropy: false,
  },
];

// ---- Boot sequence ----

export function boot() {
  const app = document.getElementById("app");
  const refreshAll = document.getElementById("refresh-all");
  const toast = document.getElementById("toast");
  if (!app) {
    console.error("RandKeyKit: #app container not found.");
    return;
  }

  const showToast = createToastController(toast);

  // Secure context check — must come before card creation
  // so we don't render cards that will fail
  const secure = checkSecureContext();

  // Live entropy visualization, refreshed on every successful generation.
  const entropyMap = createEntropyMap(document.getElementById("entropy-canvas"));

  // Create all cards
  const cards = renderCards({
    app,
    configs: CARD_CONFIGS,
    createCard: createGeneratorCard,
    copyValue: copyToClipboard,
    showToast,
    secure,
    onGenerate: () => entropyMap.render(),
  });

  wireRefreshAll({ refreshAllButton: refreshAll, cards, secure, showToast });
  wireSidebarFilters({ container: document.getElementById("sidebar"), cards });
  updateSecureContextStatus(secure);

  // Initial paint + optional manual resample button.
  entropyMap.render();
  const entropyRefresh = document.getElementById("entropy-refresh");
  if (entropyRefresh) {
    entropyRefresh.addEventListener("click", () => entropyMap.render());
  }
}

// Run on DOM ready
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}
