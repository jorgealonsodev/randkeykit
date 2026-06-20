# Arquitectura

🌐 [English](../ARCHITECTURE.md) · **Español**

RandKeyKit es una app web **estática, sin dependencias y del lado del cliente**: HTML plano + módulos ES servidos por nginx, sin framework, sin bundler y sin llamadas de red en tiempo de ejecución. Todo lo que ves se renderiza en el navegador a partir de unos pocos módulos pequeños. Este documento explica cómo encajan las piezas para que te orientes rápido.

## Modelo mental

Toda la app es **datos → tarjetas → generadores → cripto**:

```
src/main.js (CARD_CONFIGS)  ──►  src/ui/card.js  ──►  src/generators/*  ──►  src/crypto/*
   qué herramientas existen      construye el DOM      producen el valor     Web Crypto + encoding
   y sus controles/defaults      de una tarjeta        de una herramienta    (random, encoders, pem…)
```

- `main.js` declara **un objeto de configuración por herramienta** (título, descripción, controles, defaults, función generadora) y arranca la página.
- `card.js` convierte cualquier config en una tarjeta del DOM — controles, salida, botones de copiar/exportar/QR — de forma genérica. **No** conoce herramientas específicas.
- Cada `src/generators/*.js` es una función casi pura: dados unos parámetros, devuelve un valor (o un keypair con `outputs`).
- `src/crypto/*` contiene las primitivas: aleatoriedad segura, encoders, PEM, URIs OTP, etc.

Agregás una herramienta agregando una config + un generador. La UI de la tarjeta sale gratis. Ver [CONTRIBUTING.md](./CONTRIBUTING.md).

## Las piezas

| Ruta | Responsabilidad |
|------|-----------------|
| `index.html` | Shell de la app: header, sidebar/drawer, grilla `#app` vacía, dashboard, footer. La CSP + el SEO viven en el `<head>`. |
| `src/main.js` | Punto de entrada. Contiene `CARD_CONFIGS` (las 14 herramientas), renderiza las tarjetas, cablea los filtros del sidebar, el drawer móvil, refresh-all, el historial, el mapa de entropía, y registra el service worker. |
| `src/ui/card.js` | Constructor genérico de tarjetas: controles, salida, mostrar/ocultar, copiar, **menú Export** (TXT/CSV/ENV), toggle **Show QR**, lote (`COUNT`). Manejado por estado, sin lógica por herramienta. |
| `src/ui/export.js` | `buildText` / `buildCsv` / `buildEnv` + `downloadBlob` — exportación de archivos del lado del cliente. |
| `src/ui/clipboard.js` | Copiar + auto-limpiar el portapapeles tras N segundos. |
| `src/ui/history.js` | Historial de sesión en memoria (se borra al recargar — nunca se persiste). |
| `src/ui/entropy-map.js` | El canvas en vivo del "Entropy Density Map". |
| `src/ui/refresh.js` | Helper de "Refresh All". |
| `src/generators/*.js` | Un módulo por herramienta (14). Devuelve un valor, o `{ outputs: [...] }` para keypairs. |
| `src/crypto/random.js` | Acceso al CSPRNG + **rejection sampling** (sin sesgo de módulo). |
| `src/crypto/encoders.js` | Hex / Base32 / Base58 / Base64 / Base64URL. |
| `src/crypto/pem.js` | SPKI/PKCS#8 → PEM para keypairs. |
| `src/crypto/otpauth.js` | URI `otpauth://` para el QR de TOTP. |
| `src/crypto/qrcode.js` | Encoder de QR sin dependencias → SVG (modo byte, versiones 1–10). |
| `src/crypto/crack-time.js` | Entropía → estimación legible del tiempo de crackeo. |
| `sw.js` | Service worker. Precachea el shell estático para offline; **nunca cachea los secretos generados**. |
| `assets/tailwind.css` | Tailwind compilado (commiteado — no hay paso de build para servir). |
| `build-hash.txt` | Manifiesto SHA-256 publicado para verificación de cadena de suministro. |

## Cómo fluye una generación

1. El usuario hace clic en **Generate** en una tarjeta.
2. `card.js` lee los valores actuales de los controles (`params`) y llama a `generator(params)` de la config.
3. El generador usa `src/crypto/*` (p. ej. `getRandomBytes` + un encoder) y devuelve un valor — o un keypair `{ outputs: [{label, value}], value }`.
4. `card.js` renderiza el valor en el `<output>`, habilita Copy/Export y (para valores cortos) el toggle **Show QR**.
5. Copiar empuja al historial en memoria y agenda la auto-limpieza del portapapeles.

Nada de este flujo toca la red. `crypto.subtle` requiere un **contexto seguro** (HTTPS o `localhost`); sobre HTTP plano la app muestra un banner visible y deshabilita la generación.

## Decisiones de diseño clave

| Decisión | Por qué |
|----------|---------|
| Sin framework / sin bundler | La app es chica; módulos ES crudos la mantienen auditable y sin dependencias en runtime. |
| `card.js` genérico + configs por herramienta | Agregar una herramienta es una config + una función — la UI nunca se duplica. |
| CSP estricta, sin `unsafe-inline` | Sin scripts/estilos inline, sin CDN. El JSON-LD inline se permite vía hashes sha256 (ver `scripts/compute-csp-hash.mjs`). |
| Service worker = solo shell | Offline funciona, pero los secretos nunca se escriben en Cache Storage / IndexedDB / localStorage. |
| Tailwind compilado y commiteado | El sitio se sirve tal cual; `npm run build:css` solo corre cuando cambian clases. |

## Testing

Los tests de contrato del DOM y de generadores corren sobre el test runner nativo de Node contra un shell de DOM con `linkedom` — **sin navegador**.

```bash
npm run test:ui        # 82 tests en 14 archivos dentro de tests/ui/
```

> **linkedom no es un navegador.** Diverge de los navegadores reales en varios puntos (p. ej. `element.dataset` con dígitos, `document.activeElement`, claves de dataset con guiones). Para cualquier cosa sensible al renderizado del DOM, verificá también en un navegador real — `google-chrome --headless=new --screenshot` contra un server local es un chequeo rápido.
