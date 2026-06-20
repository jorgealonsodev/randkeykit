import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function collectJsFiles(directory, baseDir = directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsFiles(fullPath, baseDir));
      continue;
    }
    if (entry.name.endsWith(".js")) {
      files.push(relative(baseDir, fullPath).replace(/\\/g, "/"));
    }
  }
  return files.sort();
}

export function getDefaultFileList(rootDir) {
  const srcFiles = collectJsFiles(join(rootDir, "src"), rootDir);
  return [
    "index.html",
    "docs.html",
    "verify.html",
    "manifest.webmanifest",
    "sw.js",
    "assets/tailwind.css",
    "assets/favicon.svg",
    "assets/apple-touch-icon.png",
    "assets/og-image.png",
    "assets/entropy-map.svg",
    ...srcFiles,
  ].filter((filePath, index, list) => list.indexOf(filePath) === index && existsSync(join(rootDir, filePath)));
}

function getGitCommit(rootDir) {
  try {
    return execSync("git rev-parse HEAD", { cwd: rootDir, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "unknown";
  }
}

export function buildHashReport({ rootDir, fileList = getDefaultFileList(rootDir), buildDate = new Date().toISOString(), gitCommit = getGitCommit(rootDir) }) {
  const entries = fileList.map((filePath) => {
    const absolutePath = join(rootDir, filePath);
    const content = readFileSync(absolutePath);
    return {
      path: filePath,
      sha256: sha256(content),
      size: statSync(absolutePath).size,
    };
  });

  const aggregate = sha256(entries.map((entry) => `${entry.path}:${entry.sha256}`).join("\n"));

  const lines = [
    `build-date: ${buildDate}`,
    `git-commit: ${gitCommit}`,
    `aggregate-sha256: ${aggregate}`,
    "",
    ...entries.map((entry) => `${entry.sha256}  ${entry.path}`),
  ];

  return `${lines.join("\n")}\n`;
}

export function writeBuildHashFile({ rootDir, outputPath = join(rootDir, "build-hash.txt"), fileList, buildDate, gitCommit }) {
  const report = buildHashReport({ rootDir, fileList, buildDate, gitCommit });
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, report, "utf8");
  return report;
}

const isEntrypoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  const rootDir = process.cwd();
  const outputPath = process.argv[2] ? resolve(rootDir, process.argv[2]) : join(rootDir, "build-hash.txt");
  writeBuildHashFile({ rootDir, outputPath });
  console.log(`Build hash written to ${relative(rootDir, outputPath) || "build-hash.txt"}`);
}
