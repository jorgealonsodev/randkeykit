# RandKeyKit

Generador de claves, contraseñas y tokens criptográficos que se ejecuta completamente en tu navegador. **Nada se envía a ningún servidor.** Toda la generación ocurre en el cliente usando la Web Crypto API.

## Generadores incluidos

| # | Generador | Por defecto | Descripción |
|---|-----------|-------------|-------------|
| 1 | API Key | 48 chars, alfanumérico | Claves para autenticación de APIs |
| 2 | Contraseña | 20 chars, todos los grupos | Contraseñas robustas con caracteres configurables |
| 3 | Passphrase | 5 palabras con guiones | Frases memorables usando una wordlist EFF |
| 4 | Salt | 16 bytes, hex | Valores aleatorios para hashing de contraseñas |
| 5 | Clave AES | 256 bits, Base64 | Clave simétrica AES-GCM |
| 6 | Clave HMAC | 256 bits, Base64 | Clave para HMAC-SHA-256 |
| 7 | Token de sesión | 32 bytes, Base64URL | Token opaco para gestión de sesiones |
| 8 | Token CSRF | 32 bytes, Base64URL | Token anti-CSRF para formularios |
| 9 | Secreto TOTP | 160 bits, Base32 | Secreto para Google Authenticator y apps compatibles |

## Requisitos

- **HTTPS o localhost obligatorio.** La Web Crypto API (`crypto.subtle`) no está disponible en contextos inseguros (HTTP sin TLS, `file://`). La app lo detecta y muestra un error visible si no se cumple.
- Navegador moderno con soporte de ES modules y Web Crypto API (Chrome, Firefox, Safari, Edge actuales).
- Sin dependencias externas, sin CDN, sin build step.

## Cómo ejecutar localmente

Serví el directorio raíz con cualquier servidor HTTP estático. Ejemplos:

```bash
# Python 3
python3 -m http.server 8000

# Node.js (con npx)
npx serve .

# PHP
php -S localhost:8000
```

Luego abrí `http://localhost:8000` en tu navegador.

**No uses `file://`** — la Web Crypto API lo rechaza.

## Verificación

Para ejecutar el harness de verificación automatizado, abrí `http://localhost:8000/verify.html` después de iniciar el servidor. El harness ejecuta más de 30 assertions contra todos los generadores y primitivas criptográficas.

## Seguridad

- **100% cliente.** No se hace ninguna petición de red durante la generación. Verificable en la pestaña Network de DevTools.
- **Sin almacenamiento.** Los valores generados no se guardan en `localStorage`, cookies, ni ningún mecanismo de persistencia. Refrescá la página y desaparecen.
- **CSP estricto.** La página usa `Content-Security-Policy` sin `unsafe-inline`, eliminando una clase entera de ataques de inyección.
- **Sin `Math.random`.** Toda la aleatoriedad viene de `crypto.getRandomValues()` y `crypto.subtle.generateKey()`.
- **Rejection sampling.** Para evitar el sesgo de módulo al seleccionar caracteres de un conjunto que no divide uniformemente 2³².

## Estructura del proyecto

```
/
├── index.html              # Aplicación principal
├── verify.html             # Harness de verificación
├── styles/
│   ├── tokens.css          # Variables CSS (colores, tipografía, espaciado)
│   ├── base.css            # Reset, tipografía, accesibilidad
│   └── components.css      # Tarjetas, botones, inputs, output
├── src/
│   ├── main.js             # Punto de entrada, crea las 9 tarjetas
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
│   │   └── words.js        # Wordlist EFF (starter de 100 palabras)
│   └── ui/
│       ├── card.js         # Factoría de tarjetas de generador
│       └── clipboard.js    # Utilidad de portapapeles con fallback
└── assets/
    └── favicon.svg
```

## Despliegue

La app es completamente estática. Se puede desplegar en:

- **GitHub Pages** — Push a la rama configurada, habilitá "Enforce HTTPS".
- **Netlify** — Arrastrá la carpeta o conectá el repo.
- **Cloudflare Pages** — Conectá el repo, build command vacío, output directory `.`.
- **Vercel** — Igual que Cloudflare Pages.
- **Cualquier hosting estático** — nginx, Apache, S3 + CloudFront.

Asegurate de que el hosting sirva con **HTTPS**. La app no funciona sin él.

## Licencia

MIT
