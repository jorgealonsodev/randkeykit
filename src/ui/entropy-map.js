/**
 * Live entropy visualization.
 *
 * Draws a heatmap of REAL random bytes sampled from crypto.getRandomValues()
 * onto a canvas. It is re-rendered on every generation (and on demand), so the
 * panel reflects the actual CSPRNG output the tool produces — not decoration.
 */

const COLS = 48;
const ROWS = 16;
const BLUE = [37, 99, 235]; // primary-container #2563eb
const GREEN = [16, 185, 129]; // tertiary cue
const BG = "#0f172a"; // slate-900

export function createEntropyMap(canvas) {
  if (!canvas || typeof canvas.getContext !== "function") {
    return { render() {} };
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { render() {} };
  }

  function render() {
    const cryptoObj = globalThis.crypto;
    if (!cryptoObj || typeof cryptoObj.getRandomValues !== "function") {
      return;
    }

    const rect = typeof canvas.getBoundingClientRect === "function"
      ? canvas.getBoundingClientRect()
      : { width: canvas.width || COLS, height: canvas.height || ROWS };
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const dpr = globalThis.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    if (typeof ctx.setTransform === "function") {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, width, height);

    const bytes = new Uint8Array(COLS * ROWS);
    cryptoObj.getRandomValues(bytes);

    const cellW = width / COLS;
    const cellH = height / ROWS;
    const pad = Math.min(cellW, cellH) * 0.12;

    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const value = bytes[row * COLS + col];
        const intensity = value / 255;
        const base = value >= 128 ? GREEN : BLUE;
        const alpha = (0.12 + intensity * 0.8).toFixed(3);
        ctx.fillStyle = `rgba(${base[0]},${base[1]},${base[2]},${alpha})`;
        ctx.fillRect(col * cellW + pad, row * cellH + pad, cellW - pad * 2, cellH - pad * 2);
      }
    }
  }

  if (typeof globalThis.addEventListener === "function") {
    globalThis.addEventListener("resize", render);
  }

  return { render };
}
