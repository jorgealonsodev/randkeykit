# Despliegue

🌐 [English](../DEPLOYMENT.md) · **Español**

RandKeyKit es totalmente estático — un contenedor nginx sirve los archivos en el puerto 8080, con un reverse proxy que termina TLS por delante (en producción: Portainer + nginx-proxy-manager). Este documento cubre el flujo de deploy y las **dos trampas de caché** que causaron confusión del tipo "deployé pero sigo viendo la versión vieja".

## Camino rápido

```bash
docker compose build && docker compose up -d     # puerto custom: PORT=9000 docker compose up -d
docker compose ps                                # "(healthy)" tras ~35s
```

En producción el repo se pullea y la imagen se reconstruye vía Portainer; el proxy asigna el dominio + HTTPS. **HTTPS es obligatorio** — `crypto.subtle` no está disponible sobre HTTP plano.

## Las dos trampas de caché (leé esto)

### 1. Cache del service worker — la causa #1 de páginas viejas

`sw.js` usa **cache-first** con un `CACHE_NAME` fijo. Si deployás assets cambiados **sin cambiar `sw.js`, los visitantes recurrentes siguen sirviendo los archivos viejos cacheados para siempre** — el navegador solo reinstala el SW (y refresca su cache) cuando cambian los bytes de `sw.js`.

> **Regla: bumpeá `CACHE_NAME` en `sw.js` en cualquier deploy que cambie assets de la app.**
> `const CACHE_NAME = "randkeykit-static-v4";  // → v5, v6, …`
> Un nombre nuevo hace que el SW instale un cache fresco y purgue el viejo (ya llama a `skipWaiting()` + `clients.claim()`).

El cache del SW vive **en el navegador del usuario, no en el servidor** — no lo podés limpiar por SSH ni redeployando. Para destrabar tu propio navegador tras un deploy confuso: DevTools → Application → Service Workers → **Unregister**, y recargá.

### 2. Headers de caché de nginx

`docker/nginx.conf` setea `Cache-Control: immutable, max-age=1y` para los assets estáticos. Los nombres de archivo **no** llevan content-hash, así que la misma trampa aplica a nivel HTTP para visitantes recurrentes. El bump del cache del SW de arriba es el control principal; tenelo en cuenta si alguna vez servís assets sin el SW.

## Cuando cambiás... hacé esto

| Cambiaste | Correr antes de deployar |
|-----------|--------------------------|
| Cualquier clase de Tailwind (HTML/JS) | `npm run build:css` |
| Cualquier asset de la app (HTML/JS/CSS) | Bumpear `CACHE_NAME` en `sw.js` |
| JSON-LD inline en `index.html` / `docs.html` | `node scripts/compute-csp-hash.mjs [archivo]` (recomputar el hash de la CSP) |
| Cualquier archivo trackeado | `npm run build:hash` (refrescar `build-hash.txt`) |

## Checklist pre-deploy

- [ ] `npm run test:ui` en verde
- [ ] `npm run build:css` corrido si cambiaron clases
- [ ] `CACHE_NAME` bumpeado en `sw.js` (si cambiaron assets)
- [ ] sha256 de la CSP recomputado si cambió algún JSON-LD inline
- [ ] Render en vivo verificado en un navegador limpio (sin SW): `google-chrome --headless=new --screenshot=… https://…`
- [ ] El banner de contexto seguro **no** aparece; Generate funciona; DevTools muestra cero llamadas de red

## Verificar que un deploy realmente salió

Archivos del lado del servidor (saltea el SW del navegador):

```bash
curl -s https://randkeykit.xdev.es/sw.js | grep CACHE_NAME           # esperás la versión nueva
curl -s https://randkeykit.xdev.es/index.html | grep -c '<tu cambio>'
```

Si el servidor muestra los archivos nuevos pero tu navegador no, es el **cache del SW** (trampa #1) — desregistralo.
