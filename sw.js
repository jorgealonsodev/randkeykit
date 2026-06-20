const CACHE_NAME = "randkeykit-static-v2d";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/docs.html",
  "/verify.html",
  "/manifest.webmanifest",
  "/build-hash.txt",
  "/assets/tailwind.css",
  "/assets/favicon.svg",
  "/assets/apple-touch-icon.png",
  "/assets/og-image.png",
  "/assets/entropy-map.svg",
  "/assets/fonts/Geist-Variable.woff2",
  "/assets/fonts/Inter-Variable.woff2",
  "/assets/fonts/JetBrainsMono-Variable.woff2",
  "/assets/fonts/MaterialSymbolsOutlined.woff2",
  "/src/main.js",
  "/src/ui/card.js",
  "/src/ui/clipboard.js",
  "/src/ui/entropy-map.js",
  "/src/ui/export.js",
  "/src/ui/history.js",
  "/src/ui/refresh.js",
  "/src/crypto/crack-time.js",
  "/src/crypto/encoders.js",
  "/src/crypto/jwt-secret.js",
  "/src/crypto/otpauth.js",
  "/src/crypto/pem.js",
  "/src/crypto/qrcode.js",
  "/src/crypto/random.js",
  "/src/crypto/uuid.js",
  "/src/data/words.js",
  "/src/generators/aes-key.js",
  "/src/generators/api-key.js",
  "/src/generators/csrf-token.js",
  "/src/generators/ecdsa-keypair.js",
  "/src/generators/ed25519-keypair.js",
  "/src/generators/hmac-key.js",
  "/src/generators/jwt-secret.js",
  "/src/generators/passphrase.js",
  "/src/generators/password.js",
  "/src/generators/rsa-keypair.js",
  "/src/generators/salt.js",
  "/src/generators/session-token.js",
  "/src/generators/totp-secret.js",
  "/src/generators/uuid.js",
];

function isCacheableStaticRequest(request) {
  if (request.method !== "GET") {
    return false;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.search) {
    return false;
  }

  return STATIC_ASSETS.includes(url.pathname)
    || /\.(?:css|js|svg|png|woff2|webmanifest|html|txt)$/.test(url.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(STATIC_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((cacheName) => cacheName !== CACHE_NAME)
      .map((cacheName) => caches.delete(cacheName)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (!isCacheableStaticRequest(event.request)) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) {
      return cached;
    }

    const response = await fetch(event.request);
    if (response.ok) {
      await cache.put(event.request, response.clone());
    }
    return response;
  })());
});
