import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, '..', 'assets');
mkdirSync(assetsDir, { recursive: true });

// ── OG Image (1200×630, < 200 KB) ──────────────────────────────
const ogCanvas = createCanvas(1200, 630);
const ctx = ogCanvas.getContext('2d');

// Background: dark gradient
const grad = ctx.createLinearGradient(0, 0, 0, 630);
grad.addColorStop(0, '#0b1c30');
grad.addColorStop(1, '#00174b');
ctx.fillStyle = grad;
ctx.fillRect(0, 0, 1200, 630);

// Decorative gradient circle top-right
ctx.save();
ctx.beginPath();
ctx.arc(1050, 80, 300, 0, Math.PI * 2);
const glow = ctx.createRadialGradient(1050, 80, 50, 1050, 80, 300);
glow.addColorStop(0, 'rgba(37, 99, 235, 0.3)');
glow.addColorStop(1, 'rgba(37, 99, 235, 0)');
ctx.fillStyle = glow;
ctx.fill();
ctx.restore();

// Key icon (simple vector)
ctx.save();
ctx.translate(160, 220);
ctx.fillStyle = '#2563eb';
// Key bow (circle)
ctx.beginPath();
ctx.arc(30, 30, 30, 0, Math.PI * 2);
ctx.fill();
// Key hole
ctx.fillStyle = '#0b1c30';
ctx.beginPath();
ctx.arc(30, 30, 12, 0, Math.PI * 2);
ctx.fill();
// Key shaft
ctx.fillStyle = '#2563eb';
ctx.fillRect(55, 20, 90, 20);
// Key teeth
ctx.fillRect(135, 30, 18, 12);
ctx.fillRect(120, 30, 12, 12);
ctx.fillRect(105, 30, 12, 12);
ctx.restore();

// Title text
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 56px Geist, Inter, system-ui, sans-serif';
ctx.fillText('RandKeyKit', 250, 220);

// Subtitle
ctx.fillStyle = '#94a3b8';
ctx.font = '28px Inter, system-ui, sans-serif';
ctx.fillText('Cryptographic keys, passwords & tokens', 250, 275);

// Feature row
ctx.fillStyle = '#cbd5e1';
ctx.font = '22px Inter, system-ui, sans-serif';
const features = ['Web Crypto API', '100% Client-Side', 'Zero Tracking'];
let fx = 250;
features.forEach((f) => {
  ctx.fillText(f, fx, 340);
  fx += ctx.measureText(f).width + 40;
});

// Bottom bar
ctx.fillStyle = '#2563eb';
ctx.fillRect(0, 580, 1200, 50);

// Bottom text
ctx.fillStyle = '#ffffff';
ctx.font = '18px Inter, system-ui, sans-serif';
ctx.fillText('randkeykit.xdev.es', 70, 612);

const ogBuffer = ogCanvas.toBuffer('image/png');
writeFileSync(join(assetsDir, 'og-image.png'), ogBuffer);
console.log(`OG image: ${ogCanvas.width}x${ogCanvas.height}, ${(ogBuffer.length / 1024).toFixed(1)} KB`);

// ── Apple Touch Icon (180×180) ─────────────────────────────────
const iconCanvas = createCanvas(180, 180);
const ictx = iconCanvas.getContext('2d');

// Rounded rect background
const radius = 40;
ictx.beginPath();
ictx.moveTo(radius, 0);
ictx.lineTo(180 - radius, 0);
ictx.quadraticCurveTo(180, 0, 180, radius);
ictx.lineTo(180, 180 - radius);
ictx.quadraticCurveTo(180, 180, 180 - radius, 180);
ictx.lineTo(radius, 180);
ictx.quadraticCurveTo(0, 180, 0, 180 - radius);
ictx.lineTo(0, radius);
ictx.quadraticCurveTo(0, 0, radius, 0);
ictx.closePath();
ictx.fillStyle = '#004ac6';
ictx.fill();

// Key icon centered
ictx.fillStyle = '#ffffff';
ictx.save();
ictx.translate(30, 50);
// Bow
ictx.beginPath();
ictx.arc(40, 40, 35, 0, Math.PI * 2);
ictx.fill();
// Hole
ictx.fillStyle = '#004ac6';
ictx.beginPath();
ictx.arc(40, 40, 14, 0, Math.PI * 2);
ictx.fill();
// Shaft
ictx.fillStyle = '#ffffff';
ictx.fillRect(70, 28, 80, 24);
// Teeth
ictx.fillRect(140, 40, 20, 14);
ictx.fillRect(122, 40, 14, 14);
ictx.fillRect(104, 40, 14, 14);
ictx.restore();

const iconBuffer = iconCanvas.toBuffer('image/png');
writeFileSync(join(assetsDir, 'apple-touch-icon.png'), iconBuffer);
console.log(`Apple touch icon: ${iconCanvas.width}x${iconCanvas.height}, ${(iconBuffer.length / 1024).toFixed(1)} KB`);
