# RandKeyKit

A generator for cryptographic keys, passwords, and tokens that runs entirely in your browser. **Nothing is sent to any server.** All generation happens on the client using the Web Crypto API.

## Included generators

| # | Generator | Default | Description |
|---|-----------|---------|-------------|
| 1 | API Key | 48 chars, alphanumeric | Keys for API authentication |
| 2 | Password | 20 chars, all groups | Strong passwords with configurable character sets |
| 3 | Passphrase | 5 hyphen-separated words | Memorable phrases from an EFF wordlist |
| 4 | Salt | 16 bytes, hex | Random values for password hashing |
| 5 | AES Key | 256-bit, Base64 | Symmetric AES-GCM key |
| 6 | HMAC Key | 256-bit, Base64 | Key for HMAC-SHA-256 |
| 7 | Session Token | 32 bytes, Base64URL | Opaque token for session management |
| 8 | CSRF Token | 32 bytes, Base64URL | Anti-CSRF token for forms |
| 9 | TOTP Secret | 160-bit, Base32 | Secret for Google Authenticator and compatible apps |

## Requirements

- **HTTPS or localhost required.** The Web Crypto API (`crypto.subtle`) is unavailable in insecure contexts (HTTP without TLS, `file://`). The app detects this and shows a visible error if the requirement is not met.
- A modern browser with ES modules and Web Crypto API support (current Chrome, Firefox, Safari, Edge).
- No external dependencies and no CDN at runtime.

## Running locally

Serve the project root with any static HTTP server. Examples:

```bash
# Python 3
python3 -m http.server 8000

# Node.js (with npx)
npx serve .

# PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

**Do not use `file://`** — the Web Crypto API rejects it.

## Styles (Tailwind build)

The UI is styled with Tailwind CSS, compiled to a single self-hosted stylesheet (`assets/tailwind.css`). Fonts (Geist, Inter, JetBrains Mono, Material Symbols) are self-hosted under `assets/fonts/`, so there is no CDN at runtime.

```bash
# One-off build
npm run build:css

# Watch during development
npm run watch:css
```

The compiled `assets/tailwind.css` is committed, so the site can be served as-is without a build step.

## Verification

To run the automated verification harness, open `http://localhost:8000/verify.html` after starting the server. The harness runs 30+ assertions against every generator and cryptographic primitive.

```bash
# Headless UI tests (DOM contracts and generators)
npm run test:ui
```

## Security

- **100% client-side.** No network request is made during generation. Verifiable in the DevTools Network tab.
- **No storage.** Generated values are never written to `localStorage`, cookies, or any persistence mechanism. Refresh the page and they are gone.
- **Strict CSP.** The pages use a `Content-Security-Policy` without `unsafe-inline`, removing an entire class of injection attacks (no inline scripts, no inline styles, no CDN).
- **No `Math.random`.** All randomness comes from `crypto.getRandomValues()` and `crypto.subtle.generateKey()`.
- **Rejection sampling.** Used to avoid modulo bias when selecting characters from a set that does not evenly divide 2³².

## Project structure

```
/
├── index.html              # Main application
├── docs.html               # User-facing help & guide
├── verify.html             # Verification harness
├── tailwind.config.js      # Design tokens (Material 3 palette, type, spacing)
├── src/
│   ├── main.js             # Entry point; builds the 9 cards and wires the UI
│   ├── styles.css          # Tailwind entry + @font-face + components
│   ├── crypto/
│   │   ├── random.js       # getRandomBytes, getRandomInt (rejection sampling)
│   │   └── encoders.js     # encodeHex, encodeBase64, encodeBase64URL, encodeBase32
│   ├── generators/
│   │   ├── api-key.js
│   │   ├── password.js
│   │   ├── passphrase.js
│   │   ├── salt.js
│   │   ├── aes-key.js
│   │   ├── hmac-key.js
│   │   ├── session-token.js
│   │   ├── csrf-token.js
│   │   └── totp-secret.js
│   ├── data/
│   │   └── words.js        # EFF wordlist (100-word starter)
│   └── ui/
│       ├── card.js         # Generator card factory
│       ├── clipboard.js    # Clipboard utility with fallback
│       └── entropy-map.js  # Live canvas of real random bytes
└── assets/
    ├── tailwind.css        # Compiled stylesheet
    ├── favicon.svg         # Key icon (Material Symbols glyph)
    └── fonts/              # Self-hosted woff2 fonts
```

## Deployment

The app is fully static. It can be deployed to:

- **GitHub Pages** — push to the configured branch and enable "Enforce HTTPS".
- **Netlify** — drag the folder in or connect the repo.
- **Cloudflare Pages** — connect the repo, empty build command, output directory `.`.
- **Vercel** — same as Cloudflare Pages.
- **Any static host** — nginx, Apache, S3 + CloudFront.

Make sure the host serves over **HTTPS**. The app does not work without it.

## Deploying with Docker

The app requires HTTPS for the Web Crypto API. The container serves plain HTTP (port 8080), so you need an external reverse proxy with TLS termination in front of it.

```bash
docker compose build && docker compose up -d
```

To use a different host port:

```bash
PORT=9000 docker compose up -d
```

Check that the container is healthy:

```bash
docker compose ps
```

It should show `(healthy)` after ~35 seconds.

The container serves static files with nginx. It does **not** handle TLS or proxy configuration — that belongs to the reverse proxy exposing HTTPS externally.

## License

MIT
