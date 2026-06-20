# Contributing

🌐 **English** · [Español](./es/CONTRIBUTING.md)

The most common change is **adding a generator**. It takes two files and a config entry — the card UI is generic, so you never write DOM code. This guide covers that path first, then the dev workflow and conventions.

## Quick path: add a generator

1. **Write the generator** in `src/generators/<your-tool>.js`. It takes the card's params and returns a value:

   ```js
   import { getRandomBytes } from "../crypto/random.js";
   import { encodeHex } from "../crypto/encoders.js";

   export function generateMyToken({ bytes = 32 } = {}) {
     return encodeHex(getRandomBytes(bytes));
   }
   ```

   For a keypair, return `{ outputs: [{ label, value }], value }` instead (see `pem.js` / `rsa-keypair.js`).

2. **Register it** in `src/main.js` by adding a config object to `CARD_CONFIGS`:

   ```js
   {
     id: "my-token",
     title: "My Token",
     icon: "key",                 // Material Symbols name
     category: "tokens",          // keys | tokens | passcodes (sidebar filter)
     description: "What it is and a safe-use hint.",
     generator: generateMyToken,
     defaults: { bytes: 32 },
     controls: [
       { type: "range", label: "Bytes", param: "bytes", min: 16, max: 64, default: 32 },
     ],
     showEntropy: false,
   }
   ```

3. **Add the footer link** in `index.html` (the `<nav aria-label="Generators">` list) and bump the "Generators available" count if you show it.

4. **Test it** — add `tests/ui/<your-tool>.test.js`. Test the generator function (pure logic) and, if it has special UI, the card behavior.

5. **Verify**: `npm run test:ui`, then load it in a browser and click Generate.

Control types available in `card.js`: `range`, `select`, `text`, `checkbox`, `checkbox-group`. Selects/ranges/text auto-wire `id`/`name`/`<label for>`.

## Dev commands

| Command | What it does |
|---------|--------------|
| `npm run test:ui` | Run all DOM/generator tests (Node test runner + linkedom). |
| `npm run build:css` | Compile Tailwind → `assets/tailwind.css`. **Run after changing any class.** |
| `npm run watch:css` | Rebuild CSS on change during development. |
| `npm run build:hash` | Regenerate `build-hash.txt` (the SHA-256 manifest). |
| `python3 -m http.server 8000` | Serve the repo root (use `localhost` — Web Crypto needs a secure context). |

## Conventions

- **No inline scripts/styles.** Strict CSP forbids them. Add behavior in a module under `src/`, not an inline `<script>`. New inline JSON-LD requires re-running `scripts/compute-csp-hash.mjs`.
- **Never `Math.random`.** Use `src/crypto/random.js` (CSPRNG + rejection sampling).
- **Secrets stay in memory.** Don't write generated values to `localStorage`, cookies, IndexedDB, or the service-worker cache.
- **Rebuild CSS after class changes** — the compiled `tailwind.css` is committed, so a class that isn't compiled simply won't apply.
- **No `.only` in tests.** `check-no-only.mjs` fails the suite if a focused test is left behind.
- **Conventional commits.** e.g. `feat(ui): …`, `fix(sw): …`, `docs: …`.

### linkedom gotchas (tests pass, browser breaks)

The test DOM (`linkedom`) is not a real browser. Two traps bit us before:

- `element.dataset["a-b"] = x` (hyphenated key) **throws in browsers** but not in linkedom → use `element.setAttribute("data-a-b", x)`.
- `document.activeElement` and focus tracking aren't implemented → spy on `.focus()` instead of asserting `activeElement`.

For DOM-rendering changes, also do a real-browser check:

```bash
python3 -m http.server 8099 &
google-chrome --headless=new --window-size=1440,900 --screenshot=/tmp/x.png http://localhost:8099/
```

## Before you push

- [ ] `npm run test:ui` is green
- [ ] `npm run build:css` was run if you touched any Tailwind class
- [ ] Verified in a real browser (not just tests) for any UI/rendering change
- [ ] No inline scripts/styles added (CSP); JSON-LD hashes recomputed if changed
- [ ] No secret is persisted anywhere
- [ ] If deploying: see [DEPLOYMENT.md](./DEPLOYMENT.md) (the service-worker cache name must be bumped)
