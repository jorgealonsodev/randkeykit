# Contribuir

🌐 [English](../CONTRIBUTING.md) · **Español**

El cambio más común es **agregar un generador**. Lleva dos archivos y una entrada de config — la UI de la tarjeta es genérica, así que nunca escribís código de DOM. Esta guía cubre ese camino primero, y después el flujo de desarrollo y las convenciones.

## Camino rápido: agregar un generador

1. **Escribí el generador** en `src/generators/<tu-herramienta>.js`. Recibe los params de la tarjeta y devuelve un valor:

   ```js
   import { getRandomBytes } from "../crypto/random.js";
   import { encodeHex } from "../crypto/encoders.js";

   export function generateMyToken({ bytes = 32 } = {}) {
     return encodeHex(getRandomBytes(bytes));
   }
   ```

   Para un keypair, devolvé `{ outputs: [{ label, value }], value }` (ver `pem.js` / `rsa-keypair.js`).

2. **Registralo** en `src/main.js` agregando un objeto de config a `CARD_CONFIGS`:

   ```js
   {
     id: "my-token",
     title: "My Token",
     icon: "key",                 // nombre de Material Symbols
     category: "tokens",          // keys | tokens | passcodes (filtro del sidebar)
     description: "Qué es y una recomendación de uso seguro.",
     generator: generateMyToken,
     defaults: { bytes: 32 },
     controls: [
       { type: "range", label: "Bytes", param: "bytes", min: 16, max: 64, default: 32 },
     ],
     showEntropy: false,
   }
   ```

3. **Agregá el link del footer** en `index.html` (la lista `<nav aria-label="Generators">`) y subí el contador de "Generators available" si lo mostrás.

4. **Testealo** — agregá `tests/ui/<tu-herramienta>.test.js`. Testeá la función generadora (lógica pura) y, si tiene UI especial, el comportamiento de la tarjeta.

5. **Verificá**: `npm run test:ui`, después cargalo en un navegador y hacé clic en Generate.

Tipos de control disponibles en `card.js`: `range`, `select`, `text`, `checkbox`, `checkbox-group`. Los select/range/text cablean automáticamente `id`/`name`/`<label for>`.

## Comandos de desarrollo

| Comando | Qué hace |
|---------|----------|
| `npm run test:ui` | Corre todos los tests de DOM/generadores (test runner de Node + linkedom). |
| `npm run build:css` | Compila Tailwind → `assets/tailwind.css`. **Correr tras cambiar cualquier clase.** |
| `npm run watch:css` | Recompila el CSS al cambiar, durante el desarrollo. |
| `npm run build:hash` | Regenera `build-hash.txt` (el manifiesto SHA-256). |
| `python3 -m http.server 8000` | Sirve la raíz del repo (usá `localhost` — Web Crypto necesita contexto seguro). |

## Convenciones

- **Sin scripts/estilos inline.** La CSP estricta los prohíbe. Agregá comportamiento en un módulo bajo `src/`, no en un `<script>` inline. El JSON-LD inline nuevo requiere re-correr `scripts/compute-csp-hash.mjs`.
- **Nunca `Math.random`.** Usá `src/crypto/random.js` (CSPRNG + rejection sampling).
- **Los secretos quedan en memoria.** No escribas valores generados en `localStorage`, cookies, IndexedDB ni en el cache del service worker.
- **Recompilá el CSS tras cambios de clases** — el `tailwind.css` compilado está commiteado, así que una clase que no se compiló simplemente no se aplica.
- **Sin `.only` en los tests.** `check-no-only.mjs` falla la suite si quedó un test enfocado.
- **Conventional commits.** p. ej. `feat(ui): …`, `fix(sw): …`, `docs: …`.

### Gotchas de linkedom (los tests pasan, el navegador rompe)

El DOM de test (`linkedom`) no es un navegador real. Dos trampas que ya nos mordieron:

- `element.dataset["a-b"] = x` (clave con guion) **tira excepción en navegadores** pero no en linkedom → usá `element.setAttribute("data-a-b", x)`.
- `document.activeElement` y el tracking de foco no están implementados → espiá `.focus()` en vez de asertar `activeElement`.

Para cambios de renderizado del DOM, hacé también un chequeo en navegador real:

```bash
python3 -m http.server 8099 &
google-chrome --headless=new --window-size=1440,900 --screenshot=/tmp/x.png http://localhost:8099/
```

## Antes de pushear

- [ ] `npm run test:ui` en verde
- [ ] `npm run build:css` corrido si tocaste alguna clase de Tailwind
- [ ] Verificado en un navegador real (no solo tests) para cualquier cambio de UI/render
- [ ] Sin scripts/estilos inline agregados (CSP); hashes de JSON-LD recomputados si cambiaron
- [ ] Ningún secreto persiste en ningún lado
- [ ] Si vas a deployar: ver [DEPLOYMENT.md](./DEPLOYMENT.md) (hay que bumpear el nombre del cache del service worker)
