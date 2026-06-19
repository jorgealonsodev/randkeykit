import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const testsRoot = path.resolve("tests/ui");
const patterns = [
  { label: ".only(", regex: /\.only\s*\(/ },
  { label: "test.only(", regex: /\btest\.only\s*\(/ },
  { label: "describe.only(", regex: /\bdescribe\.only\s*\(/ },
  { label: "it.only(", regex: /\bit\.only\s*\(/ },
];

async function getFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return getFiles(fullPath);
    }

    if (entry.isFile() && /\.(c|m)?js$/.test(entry.name)) {
      return [fullPath];
    }

    return [];
  }));

  return files.flat();
}

function getMatches(content) {
  return content
    .split("\n")
    .flatMap((line, index) => patterns
      .filter(({ regex }) => regex.test(line))
      .map(({ label }) => ({ line: index + 1, label })));
}

const offenders = [];
for (const file of await getFiles(testsRoot)) {
  const content = await readFile(file, "utf8");
  const matches = getMatches(content);
  if (matches.length > 0) {
    offenders.push({ file, matches });
  }
}

if (offenders.length > 0) {
  console.error("Focused UI tests are not allowed. Remove .only markers before running test:ui.\n");
  offenders.forEach(({ file, matches }) => {
    const relativePath = path.relative(process.cwd(), file);
    matches.forEach(({ line, label }) => {
      console.error(`- ${relativePath}:${line} contains ${label}`);
    });
  });
  process.exit(1);
}
