# Architecture

RandKeyKit is a **static, zero-dependency, client-side** web app: plain HTML + ES modules served by nginx, with no framework, no bundler, and no runtime network calls. Everything you see is rendered in the browser from a handful of small modules. This doc explains how the pieces fit so you can find your way around quickly.

## Mental model

The whole app is **data → cards → generators → crypto**:

```
src/main.js (CARD_CONFIGS)  ──►  src/ui/card.js  ──►  src/generators/*  ──►  src/crypto/*
   what tools exist & their       builds the DOM        produce the value     Web Crypto + encoding
   controls/defaults              for one tool          for one tool          (random, encoders, pem…)
```

- `main.js` declares **one config object per tool** (title, description, controls, defaults, generator function) and boots the page.
- `card.js` turns any config into a DOM card — controls, output, copy/export/QR buttons — generically. It does **not** know about specific tools.
- Each `src/generators/*.js` is a pure-ish function: given params, return a value (or a keypair with `outputs`).
- `src/crypto/*` holds the primitives: secure randomness, encoders, PEM, OTP URIs, etc.

Add a tool by adding a config + a generator. The card UI comes for free. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## The pieces

| Path | Responsibility |
|------|----------------|
| `index.html` | App shell: header, sidebar/drawer, empty `#app` grid, dashboard, footer. CSP + SEO live in `<head>`. |
| `src/main.js` | Entry point. Holds `CARD_CONFIGS` (the 14 tools), renders cards, wires sidebar filters, mobile drawer, refresh-all, history, entropy map, and registers the service worker. |
| `src/ui/card.js` | Generic card builder: controls, output, show/hide, copy, **Export dropdown** (TXT/CSV/ENV), **Show QR** toggle, batch (`COUNT`). State-driven, no per-tool logic. |
| `src/ui/export.js` | `buildText` / `buildCsv` / `buildEnv` + `downloadBlob` — client-side file export. |
| `src/ui/clipboard.js` | Copy + auto-clear-clipboard-after-N-seconds. |
| `src/ui/history.js` | In-memory session history (cleared on reload — never persisted). |
| `src/ui/entropy-map.js` | The live "Entropy Density Map" canvas. |
| `src/ui/refresh.js` | "Refresh All" helper. |
| `src/generators/*.js` | One module per tool (14). Returns a value, or `{ outputs: [...] }` for keypairs. |
| `src/crypto/random.js` | CSPRNG access + **rejection sampling** (no modulo bias). |
| `src/crypto/encoders.js` | Hex / Base32 / Base58 / Base64 / Base64URL. |
| `src/crypto/pem.js` | SPKI/PKCS#8 → PEM for keypairs. |
| `src/crypto/otpauth.js` | `otpauth://` URI for TOTP QR. |
| `src/crypto/qrcode.js` | Dependency-free QR encoder → SVG (byte mode, versions 1–10). |
| `src/crypto/crack-time.js` | Entropy → human crack-time estimate. |
| `sw.js` | Service worker. Precaches the static shell for offline; **never caches generated secrets**. |
| `assets/tailwind.css` | Compiled Tailwind (committed — no build step to serve). |
| `build-hash.txt` | Published SHA-256 manifest for supply-chain verification. |

## How one generation flows

1. User clicks **Generate** on a card.
2. `card.js` reads the current control values (`params`) and calls the config's `generator(params)`.
3. The generator uses `src/crypto/*` (e.g. `getRandomBytes` + an encoder) and returns a value — or a keypair `{ outputs: [{label, value}], value }`.
4. `card.js` renders the value into the `<output>`, enables Copy/Export, and (for short values) the **Show QR** toggle.
5. Copy pushes to the in-memory history and schedules the clipboard auto-clear.

Nothing in this flow touches the network. `crypto.subtle` requires a **secure context** (HTTPS or `localhost`); on plain HTTP the app shows a visible banner and disables generation.

## Key design decisions

| Decision | Why |
|----------|-----|
| No framework / no bundler | The app is small; raw ES modules keep it auditable and dependency-free at runtime. |
| Generic `card.js` + per-tool configs | Adding a tool is a config + a function — the UI is never duplicated. |
| Strict CSP, no `unsafe-inline` | No inline scripts/styles, no CDN. Inline JSON-LD is allowed via sha256 hashes (see `scripts/compute-csp-hash.mjs`). |
| Service worker = shell only | Offline works, but secrets are never written to Cache Storage / IndexedDB / localStorage. |
| Tailwind compiled & committed | The site serves as-is; `npm run build:css` only runs when classes change. |

## Testing

DOM-contract and generator tests run on Node's built-in test runner against a `linkedom` DOM shell — **no browser needed**.

```bash
npm run test:ui        # 82 tests across 14 files in tests/ui/
```

> **linkedom is not a browser.** It diverges from real browsers in places (e.g. `element.dataset` with digits, `document.activeElement`, hyphenated dataset keys). For anything DOM-rendering-sensitive, verify in a real browser too — `google-chrome --headless=new --screenshot` against a local server is a fast check.
