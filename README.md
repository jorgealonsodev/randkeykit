# RandKeyKit

Generate cryptographic keys, passwords, and tokens **entirely in your browser — nothing is ever sent to a server.** Every value is produced locally with the Web Crypto API, so secrets never touch the network and nothing is stored.

## Quick start

```bash
# Serve the project root with any static server
python3 -m http.server 8000      # or: npx serve .   |   php -S localhost:8000
```

1. Open `http://localhost:8000`
2. Pick a tool, set the options (the defaults are already secure)
3. Click **Generate**, then **Copy**

> **HTTPS or localhost is required.** The Web Crypto API (`crypto.subtle`) is unavailable over plain HTTP or `file://`. The app shows a visible error if the context is insecure.

## What you can generate

| Generator | Default | Good for |
|-----------|---------|----------|
| API Key | 48 chars, alphanumeric | Authenticating API clients |
| Password | 20 chars, all groups | Strong account passwords |
| Passphrase | 5 hyphen-separated words | Memorable phrases (EFF wordlist) |
| Salt | 16 bytes, hex | Password hashing (bcrypt/scrypt/argon2) |
| AES Key | 256-bit, Base64 | Symmetric encryption (AES-GCM) |
| HMAC Key | 256-bit, Base64 | Message authentication (HMAC-SHA-256) |
| RSA Keypair | RSA-OAEP 3072, PEM | Public/private keypairs for encryption or signing |
| ECDSA Keypair | P-256, PEM | Elliptic-curve signing keypairs |
| Ed25519 Keypair | PEM | Modern signing keypairs when supported by the browser |
| Session Token | 32 bytes, Base64URL | Opaque session identifiers |
| CSRF Token | 32 bytes, Base64URL | Anti-CSRF form tokens |
| TOTP Secret | 160-bit, Base32 | Google Authenticator & compatible apps |

## Why it's safe

| Guarantee | How |
|-----------|-----|
| Nothing leaves your device | 100% client-side — verify in the DevTools Network tab |
| Nothing is stored | No `localStorage`, cookies, or persistence; refresh and it's gone |
| Real randomness | `crypto.getRandomValues()` and `crypto.subtle.generateKey()` — never `Math.random` |
| No bias | Rejection sampling avoids modulo bias when a charset doesn't divide 2³² |
| Hardened pages | Strict CSP without `unsafe-inline` — no inline scripts, no inline styles, no CDN |

## Develop

Requirements: a modern browser (ES modules + Web Crypto) and Node.js for the tooling.

```bash
npm run build:css     # compile Tailwind → assets/tailwind.css
npm run build:hash    # regenerate build-hash.txt
npm run watch:css     # rebuild on change during development
npm run test:ui       # headless DOM-contract and generator tests
```

The compiled `assets/tailwind.css` is committed, so the site serves as-is without a build step. Fonts (Geist, Inter, JetBrains Mono, Material Symbols) are self-hosted under `assets/fonts/` — no CDN at runtime.

For a deeper check, open `http://localhost:8000/verify.html` — it explains how to verify the zero-network behavior, inspect the service-worker cache, compare `build-hash.txt`, and run the browser-side harness.

<details>
<summary>Project structure</summary>

```
/
├── index.html              # Main application
├── docs.html               # User-facing help & guide
├── verify.html             # Verification harness
├── tailwind.config.js      # Design tokens (Material 3 palette, type, spacing)
├── src/
│   ├── main.js             # Entry point; builds the 14 cards, SW registration, and UI wiring
│   ├── styles.css          # Tailwind entry + @font-face + components
│   ├── crypto/             # random (rejection sampling), encoders, pem, otpauth, qrcode, crack-time…
│   ├── generators/         # one module per generator (14 total)
│   ├── data/words.js       # Bundled EFF large wordlist (7776 words)
│   └── ui/                 # card, clipboard, entropy-map, export, history, refresh
├── sw.js                   # Static-shell service worker (never caches generated secrets)
├── build-hash.txt          # Published SHA-256 manifest for local verification
├── scripts/build-hash.mjs  # Regenerates build-hash.txt
└── assets/                 # tailwind.css, favicon.svg, fonts/
```

</details>

## Documentation

🌐 Available in [English](./docs/) · [Español](./docs/es/)

Working on the repo? The guides in [`docs/`](./docs/) go deeper:

| Guide | For |
|-------|-----|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | How the app is built and where things live |
| [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) | Adding a generator, running tests, conventions |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Shipping a change + the service-worker / nginx cache traps |

Using the app (not the repo)? See the in-app guide at `/docs.html`.

## Deploy

The app is fully static. Serve it over **HTTPS** (required for Web Crypto) on any of:

- **GitHub Pages** — push to the configured branch, enable "Enforce HTTPS"
- **Netlify / Cloudflare Pages / Vercel** — connect the repo, empty build command, output directory `.`
- **Any static host** — nginx, Apache, S3 + CloudFront

### Docker

The container serves plain HTTP on port 8080, so put a TLS-terminating reverse proxy in front of it for public use.

```bash
docker compose build && docker compose up -d   # custom port: PORT=9000 docker compose up -d
docker compose ps                              # shows "(healthy)" after ~35s
```

Before going public:

- [ ] HTTPS is terminated by a proxy in front of the container
- [ ] The page loads and the secure-context banner is **not** shown
- [ ] Generating a value works (DevTools shows no network calls)
- [ ] `build-hash.txt` was regenerated after the last asset change

## Offline install + trust verification

- The app registers `/sw.js` and precaches only the static shell: HTML, CSS, icons, fonts, and local JS modules.
- Generated secrets are **never** written into Cache Storage, IndexedDB, or localStorage by the service worker.
- After one successful online load, the main shell opens offline and generators still work because everything runs client-side.

### Rebuild the published hash manifest

```bash
npm run build:hash
```

This rewrites `build-hash.txt` with:

- the build date
- the current git commit hash when available
- one SHA-256 line per tracked app artifact
- an aggregate SHA-256 over the manifest entries

### Verify it locally

1. Open `build-hash.txt`
2. Run `sha256sum` over the listed files locally
3. Compare the hashes line by line
4. Open `verify.html` and follow the DevTools checklist for zero-network generation and service-worker cache inspection

### Why SRI is not used on self-hosted scripts

RandKeyKit serves all runtime scripts from the same origin. In that setup, adding `integrity="..."` to same-origin scripts does not materially improve the threat model compared with:

- strict same-origin CSP
- HTTPS
- the published `build-hash.txt`

If a future cross-origin runtime asset is introduced, that resource **should** use SRI.

## SEO and Submitting to Search Engines

RandKeyKit includes everything search engines need to discover and rank the page:

| Asset | Location | Purpose |
|-------|----------|---------|
| `robots.txt` | `/robots.txt` | Allows all crawlers and points to the sitemap |
| `sitemap.xml` | `/sitemap.xml` | Lists the index page with `lastmod`, `changefreq`, and `priority` |
| `404.html` | `/404.html` | Styled error page with a link back to `/` |
| `manifest.webmanifest` | `/manifest.webmanifest` | PWA manifest for installable web app experience |
| JSON-LD inline | `<head>` of `index.html` | Structured data (`WebSite` + `SoftwareApplication`) for rich results |
| OG meta tags | `<head>` of `index.html` | Open Graph and Twitter Card tags for social previews |

### Submitting to Google Search Console

1. Go to [Google Search Console](https://search.google.com/search-console) and add `https://randkeykit.xdev.es/` as a new property.
2. Verify ownership using the recommended method (DNS TXT record, HTML file upload, or Google Analytics).
3. Once verified, go to **Sitemaps** in the sidebar and submit `https://randkeykit.xdev.es/sitemap.xml`.
4. Use the **URL Inspection** tool to request indexing for `https://randkeykit.xdev.es/`.

### Validating Structured Data

Copy the full URL (`https://randkeykit.xdev.es/`) and paste it into:

- [Google Rich Results Test](https://search.google.com/test/rich-results) — confirms `WebSite` and `SoftwareApplication` are detected
- [Schema.org Validator](https://validator.schema.org/) — checks JSON-LD syntax and schema compliance

### Updating the Sitemap Date

The `lastmod` field in `sitemap.xml` tracks the last significant content update. To update it:

1. Edit `sitemap.xml` and change the `<lastmod>` value to the current date (`YYYY-MM-DD`).
2. Optionally, regenerate the OG image and icons with `node scripts/generate-og-images.mjs`.
3. Commit and redeploy.

No build step is needed for SEO changes — all assets are static.

### Manual Lighthouse Audit

To run a Lighthouse SEO audit locally:

1. Start the container: `docker compose up -d`
2. Open Chrome DevTools → **Lighthouse** tab
3. Select **SEO** category and run the audit on `http://localhost:8080`
4. The target score is ≥ 90

For automated CI checks, see `openspec/changes/randkeykit-seo/tasks.md` task 6.1 (deferred to a follow-up PR).

## License

MIT
