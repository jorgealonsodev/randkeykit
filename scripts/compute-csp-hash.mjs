import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const filename = process.argv[2] || 'index.html';
const html = readFileSync(filename, 'utf8');
const regex = /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g;
const hashes = [];
let match;
while ((match = regex.exec(html)) !== null) {
  const content = match[1];
  const hash = createHash('sha256').update(content).digest('base64');
  hashes.push(`'sha256-${hash}'`);
}

if (hashes.length === 0) {
  console.log('No inline JSON-LD blocks found. CSP hash unchanged.');
  process.exit(0);
}

const cspRegex = /script-src 'self'(?:\s+'sha256-[^']+')*/;
const replacement = `script-src 'self' ${hashes.join(' ')}`;

if (!cspRegex.test(html)) {
  console.error('Could not find script-src placeholder in CSP meta tag.');
  process.exit(1);
}

const updated = html.replace(cspRegex, replacement);
writeFileSync(filename, updated);
console.log(`CSP hash updated in ${filename}: ${hashes.join(' ')}`);
