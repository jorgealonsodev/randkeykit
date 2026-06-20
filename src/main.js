/**
 * RandKeyKit — Main Entry Point
 *
 * Boot sequence:
 * 1. Check crypto.subtle availability (secure context guard)
 * 2. Import all generators
 * 3. Create generator cards with controls
 * 4. Append cards to the DOM
 */

import { createGeneratorCard } from "./ui/card.js";
import { copyToClipboard } from "./ui/clipboard.js";
import { createEntropyMap } from "./ui/entropy-map.js";
import { getRefreshAllToastMessage } from "./ui/refresh.js";
import { createHistoryStore, formatPreview } from "./ui/history.js";
import { generateAPIKey, estimateEntropy as estimateAPIKeyEntropy } from "./generators/api-key.js";
import { generatePassword, estimateEntropy as estimatePasswordEntropy } from "./generators/password.js";
import { generatePassphrase, estimateEntropy as estimatePassphraseEntropy } from "./generators/passphrase.js";
import { generateSalt } from "./generators/salt.js";
import { generateAESKey } from "./generators/aes-key.js";
import { generateHMACKey } from "./generators/hmac-key.js";
import { generateSessionToken } from "./generators/session-token.js";
import { generateCSRFToken } from "./generators/csrf-token.js";
import { generateTOTPSecret } from "./generators/totp-secret.js";
import { buildOtpauthUri } from "./crypto/otpauth.js";
import { generateUuid } from "./generators/uuid.js";
import { generateJwtSecretCard } from "./generators/jwt-secret.js";
import { generateRSAKeypair } from "./generators/rsa-keypair.js";
import { generateECDSAKeypair } from "./generators/ecdsa-keypair.js";
import { generateEd25519Keypair, isEd25519Supported } from "./generators/ed25519-keypair.js";
export const GENERATE_PLACEHOLDER = "Generate a new value to preview it here.";
const REFRESH_ALL_DEFAULT_LABEL = `<span class="material-symbols-outlined">refresh</span> Refresh All`;
const REFRESH_ALL_LOADING_LABEL = `<span class="material-symbols-outlined">progress_activity</span> Refreshing…`;
export const OFFLINE_READY_MESSAGE = "Offline shell ready.";

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

export function updateOfflineReadyStatus(ready) {
  const badge = document.getElementById("offline-ready-badge");
  if (!badge) return;

  badge.hidden = !ready;
}

export async function registerServiceWorker({ showToast = () => {}, onOfflineReady = () => {} } = {}) {
  if (!("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    onOfflineReady(true);
    showToast(OFFLINE_READY_MESSAGE);
    return registration;
  } catch (error) {
    console.warn("RandKeyKit: service worker registration failed.", error);
    return null;
  }
}

export async function wireEd25519Availability(card) {
  if (!card?.setAvailability) return false;

  const supported = await isEd25519Supported();
  if (!supported) {
    card.setAvailability({
      supported: false,
      message: "Ed25519 is not supported in this browser.",
    });
  }

  return supported;
}

export function renderCards({ app, configs, createCard, copyValue, showToast, secure, onGenerate, onCopy, autoClearMs }) {
  const cards = configs.map((config) => createCard(
    { ...config, onCopy, autoClearMs },
    copyValue,
    showToast,
    onGenerate,
  ));

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
      button.classList.toggle("bg-primary", isActive);
      button.classList.toggle("text-white", isActive);
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
 * Card definitions for all generators.
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
        { value: "base58", label: "Base58" },
      ]},
      { type: "text", label: "Prefix", param: "prefix", default: "", placeholder: "Optional prefix (safe ASCII)" },
    ],
    showEntropy: true,
    entropy: (params) => estimateAPIKeyEntropy(params),
    showCrackTime: true,
    batchable: true,
    exportKeyName: "api-key",
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
    showCrackTime: true,
    batchable: true,
    exportKeyName: "password",
  },
  {
    id: "passphrase",
    title: "Passphrase",
    icon: "chat_bubble_outline",
    category: "passcodes",
    description: "Memorable passphrase from random dictionary words. Easier to type and remember than passwords.",
    generator: generatePassphrase,
    defaults: { words: 5, separator: "-", capitalize: false, appendNumber: false, wordlist: "eff-large" },
    controls: [
      { type: "range", label: "Words", param: "words", min: 3, max: 10, default: 5, hint: "count" },
      { type: "text", label: "Separator", param: "separator", default: "-" },
      { type: "select", label: "Wordlist", param: "wordlist", default: "eff-large", options: [
        { value: "eff-large", label: "EFF large" },
      ]},
      { type: "checkbox", label: "Capitalize", param: "capitalize", default: false },
      { type: "checkbox", label: "Append number", param: "appendNumber", default: false },
    ],
    showEntropy: true,
    entropy: (params) => estimatePassphraseEntropy(params),
    showCrackTime: true,
    batchable: true,
    exportKeyName: "passphrase",
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
        { value: "base58", label: "Base58" },
      ]},
    ],
    showEntropy: false,
    batchable: true,
    exportKeyName: "salt",
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
        { value: "base58", label: "Base58" },
      ]},
    ],
    showEntropy: false,
    batchable: true,
    exportKeyName: "aes-key",
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
        { value: "base58", label: "Base58" },
      ]},
    ],
    showEntropy: false,
    batchable: true,
    exportKeyName: "hmac-key",
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
        { value: "base58", label: "Base58" },
      ]},
    ],
    showEntropy: false,
    batchable: true,
    exportKeyName: "session-token",
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
        { value: "base58", label: "Base58" },
      ]},
    ],
    showEntropy: false,
    batchable: true,
    exportKeyName: "csrf-token",
  },
  {
    id: "uuid",
    title: "UUID",
    icon: "fingerprint",
    category: "tokens",
    description: "RFC 9562 UUIDs for identifiers, correlation IDs, and sortable event keys.",
    generator: generateUuid,
    defaults: { version: "v4", batchCount: 1 },
    controls: [
      { type: "select", label: "Version", param: "version", default: "v4", options: [
        { value: "v4", label: "UUID v4 (random)" },
        { value: "v7", label: "UUID v7 (time-ordered)" },
      ]},
    ],
    showEntropy: false,
    batchable: true,
    exportKeyName: "uuid",
  },
  {
    id: "jwt-secret",
    title: "JWT Secret",
    icon: "token",
    category: "tokens",
    description: "HMAC signing secret for JWT issuers and verifiers. Use HS512 when you need one secret for every HS algorithm.",
    generator: generateJwtSecretCard,
    defaults: { algorithm: "HS256" },
    controls: [
      { type: "select", label: "Algorithm", param: "algorithm", default: "HS256", options: [
        { value: "HS256", label: "HS256 (32 bytes)" },
        { value: "HS384", label: "HS384 (48 bytes)" },
        { value: "HS512", label: "HS512 (64 bytes)" },
        { value: "any", label: "Any (64 bytes)" },
      ]},
    ],
    showEntropy: false,
    batchable: true,
    exportKeyName: "jwt-secret",
  },
  {
    id: "totp-secret",
    title: "TOTP Secret",
    icon: "cell_tower",
    category: "passcodes",
    description: "Base32-encoded secret for Time-based One-Time Passwords (Google Authenticator compatible).",
    generator: generateTOTPSecret,
    defaults: { bits: 160, issuer: "RandKeyKit", account: "", batchCount: 1 },
    controls: [
      { type: "select", label: "Secret size", param: "bits", default: 160, parse: Number, options: [
        { value: 160, label: "160-bit (20B)" },
        { value: 256, label: "256-bit (32B)" },
        { value: 320, label: "320-bit (40B)" },
      ]},
      { type: "text", label: "Issuer", param: "issuer", default: "RandKeyKit", placeholder: "Authenticator issuer" },
      { type: "text", label: "Account", param: "account", default: "", placeholder: "user@example.com" },
    ],
    showEntropy: false,
    batchable: true,
    exportKeyName: "totp-secret",
    qrValue: (result, params) => {
      const secret = result.values?.[0];
      if (!secret) return null;
      return buildOtpauthUri({
        secret,
        issuer: params.issuer || "RandKeyKit",
        account: params.account || "",
      });
    },
  },
  {
    id: "rsa-keypair",
    title: "RSA Keypair",
    icon: "vpn_key",
    category: "keys",
    description: "Asymmetric encryption or signing keypair with PEM export. RSA-4096 is available but may take 1–3 seconds.",
    generator: generateRSAKeypair,
    defaults: { algorithm: "RSA-OAEP", bits: 3072 },
    controls: [
      { type: "select", label: "Algorithm", param: "algorithm", default: "RSA-OAEP", options: [
        { value: "RSA-OAEP", label: "RSA-OAEP (encryption)" },
        { value: "RSA-PSS", label: "RSA-PSS (signing)" },
      ]},
      { type: "select", label: "Key size", param: "bits", default: 3072, parse: Number, options: [
        { value: 2048, label: "2048-bit" },
        { value: 3072, label: "3072-bit" },
        { value: 4096, label: "4096-bit (slower)" },
      ]},
    ],
    showEntropy: false,
  },
  {
    id: "ecdsa-keypair",
    title: "ECDSA Keypair",
    icon: "gesture",
    category: "keys",
    description: "Signing keypair for elliptic-curve signatures with PKCS#8 and SPKI PEM export.",
    generator: generateECDSAKeypair,
    defaults: { curve: "P-256" },
    controls: [
      { type: "select", label: "Curve", param: "curve", default: "P-256", options: [
        { value: "P-256", label: "P-256" },
        { value: "P-384", label: "P-384" },
        { value: "P-521", label: "P-521" },
      ]},
    ],
    showEntropy: false,
  },
  {
    id: "ed25519-keypair",
    title: "Ed25519 Keypair",
    icon: "signature",
    category: "keys",
    description: "Modern signing keypair with graceful browser support detection and PEM export.",
    generator: generateEd25519Keypair,
    defaults: {},
    controls: [],
    showEntropy: false,
  },
];

// ---- History panel ----

export function renderHistoryPanel({ container, store, copyValue, showToast }) {
  if (!container) return;

  const list = container.querySelector("[data-history-list]");
  const emptyState = container.querySelector("[data-history-empty]");
  const clearButton = container.querySelector("[data-action='clear-history']");

  if (!list) return;

  function renderEntries() {
    const entries = store.getAll();
    list.innerHTML = "";

    if (entries.length === 0) {
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (emptyState) emptyState.hidden = true;

    entries.forEach((entry) => {
      const li = document.createElement("li");
      li.className = "flex items-center justify-between gap-3 py-2 border-b border-outline-variant/30 last:border-0";

      const info = document.createElement("div");
      info.className = "flex-1 min-w-0";

      const preview = document.createElement("span");
      preview.className = "font-mono text-body-sm text-on-surface block truncate";
      preview.textContent = formatPreview(entry.value, entry.count);

      const meta = document.createElement("span");
      meta.className = "text-body-sm text-secondary block";
      const time = entry.timestamp.toLocaleTimeString();
      meta.textContent = `${entry.source} · ${time}`;

      info.append(preview, meta);

      const copyAgainButton = document.createElement("button");
      copyAgainButton.type = "button";
      copyAgainButton.className = "p-1 rounded text-on-surface-variant hover:text-primary transition-colors focus-visible:ring-2 focus-visible:ring-primary/40";
      copyAgainButton.setAttribute("aria-label", `Copy ${entry.source} value again`);
      copyAgainButton.innerHTML = `<span class="material-symbols-outlined text-[18px]" aria-hidden="true">content_copy</span>`;
      copyAgainButton.addEventListener("click", async () => {
        const success = await copyValue(entry.value);
        if (success) {
          showToast(`${entry.source} copied again.`);
        }
      });

      li.append(info, copyAgainButton);
      list.appendChild(li);
    });
  }

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      store.clear();
      renderEntries();
    });
  }

  renderEntries();
  return renderEntries;
}

// ---- Auto-clear config ----

const AUTO_CLEAR_OPTIONS = [
  { value: 10000, label: "10 seconds" },
  { value: 30000, label: "30 seconds" },
  { value: 60000, label: "60 seconds" },
  { value: 0, label: "Never" },
];

export function getAutoClearMs(selectElement) {
  if (!selectElement) return () => 30000;
  return () => Number(selectElement.value) || 0;
}

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

  // History store (in-memory, ephemeral)
  const historyStore = createHistoryStore(20);

  // Auto-clear config
  const autoClearSelect = document.getElementById("auto-clear-select");
  const autoClearMs = getAutoClearMs(autoClearSelect);

  // History callback
  let refreshHistory = null;
  const onCopy = (entry) => {
    historyStore.push(entry);
    if (typeof refreshHistory === "function") {
      refreshHistory();
    }
  };

  // Create all cards
  const cards = renderCards({
    app,
    configs: CARD_CONFIGS,
    createCard: createGeneratorCard,
    copyValue: copyToClipboard,
    showToast,
    secure,
    onGenerate: () => entropyMap.render(),
    onCopy,
    autoClearMs,
  });

  wireRefreshAll({ refreshAllButton: refreshAll, cards, secure, showToast });
  wireSidebarFilters({ container: document.getElementById("sidebar"), cards });
  updateSecureContextStatus(secure);
  updateOfflineReadyStatus(false);

  // Wire history panel
  const historyPanel = document.getElementById("history-panel");
  refreshHistory = renderHistoryPanel({
    container: historyPanel,
    store: historyStore,
    copyValue: copyToClipboard,
    showToast,
  });

  // Initial paint + optional manual resample button.
  entropyMap.render();
  const entropyRefresh = document.getElementById("entropy-refresh");
  if (entropyRefresh) {
    entropyRefresh.addEventListener("click", () => entropyMap.render());
  }

  if (secure) {
    const ed25519Card = cards.find((card) => card.id === "ed25519-keypair");
    void wireEd25519Availability(ed25519Card).catch((error) => {
      console.warn("RandKeyKit: Ed25519 probe failed.", error);
    });

    void registerServiceWorker({
      showToast,
      onOfflineReady: updateOfflineReadyStatus,
    });
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
