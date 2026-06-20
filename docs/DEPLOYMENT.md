# Deployment

RandKeyKit is fully static — an nginx container serves the files on port 8080, with a TLS-terminating reverse proxy in front (in production: Portainer + nginx-proxy-manager). This doc covers the deploy flow and the **two caching traps** that have caused "I deployed but still see the old version" confusion.

## Quick path

```bash
docker compose build && docker compose up -d     # custom port: PORT=9000 docker compose up -d
docker compose ps                                # "(healthy)" after ~35s
```

In production the repo is pulled and the image rebuilt via Portainer; the proxy assigns the domain + HTTPS. **HTTPS is required** — `crypto.subtle` is unavailable over plain HTTP.

## The two caching traps (read this)

### 1. Service worker cache — the #1 cause of stale pages

`sw.js` uses **cache-first** with a fixed `CACHE_NAME`. If you deploy changed assets **without changing `sw.js`, returning visitors keep serving the old cached files forever** — the browser only re-installs the SW (and refreshes its cache) when `sw.js` bytes change.

> **Rule: bump `CACHE_NAME` in `sw.js` on any deploy that changes app assets.**
> `const CACHE_NAME = "randkeykit-static-v4";  // → v5, v6, …`
> A new name makes the SW install a fresh cache and purge the old one (it already calls `skipWaiting()` + `clients.claim()`).

The SW cache lives **in the user's browser, not on the server** — you cannot clear it via SSH or a server redeploy. To unstick your own browser after a confusing deploy: DevTools → Application → Service Workers → **Unregister**, then reload.

### 2. nginx asset cache headers

`docker/nginx.conf` sets `Cache-Control: immutable, max-age=1y` for static assets. Filenames are **not** content-hashed, so the same trap applies at the HTTP layer for returning visitors. The SW cache-bump above is the primary control; keep this in mind if you ever serve assets without the SW.

## When you change... do this

| You changed | Run before deploy |
|-------------|-------------------|
| Any Tailwind class (HTML/JS) | `npm run build:css` |
| Any app asset (HTML/JS/CSS) | Bump `CACHE_NAME` in `sw.js` |
| Inline JSON-LD in `index.html` / `docs.html` | `node scripts/compute-csp-hash.mjs [file]` (recompute CSP hash) |
| Anything tracked | `npm run build:hash` (refresh `build-hash.txt`) |

## Pre-deploy checklist

- [ ] `npm run test:ui` green
- [ ] `npm run build:css` run if classes changed
- [ ] `CACHE_NAME` bumped in `sw.js` (if assets changed)
- [ ] CSP sha256 recomputed if any inline JSON-LD changed
- [ ] Verified the live render in a clean browser (no SW): `google-chrome --headless=new --screenshot=… https://…`
- [ ] Secure-context banner is **not** shown; Generate works; DevTools shows zero network calls

## Verify a deploy actually shipped

Server-side files (bypasses the browser SW):

```bash
curl -s https://randkeykit.xdev.es/sw.js | grep CACHE_NAME           # expect the new version
curl -s https://randkeykit.xdev.es/index.html | grep -c '<your change>'
```

If the server shows the new files but your browser doesn't, it's the **SW cache** (trap #1) — unregister it.
