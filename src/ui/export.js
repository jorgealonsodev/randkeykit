function escapeCsv(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function escapeEnvValue(value) {
  const text = String(value ?? "");
  if (!/[\s"'`#\\]/.test(text)) {
    return text;
  }
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function buildText(values) {
  return values.join("\n");
}

export function buildCsv(values) {
  const rows = values.map((value, index) => `${index + 1},${escapeCsv(value)}`);
  return ["index,value", ...rows].join("\n");
}

export function toEnvKeyBase(keyBase) {
  return String(keyBase ?? "VALUE")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase() || "VALUE";
}

export function buildEnv(values, keyBase) {
  const base = toEnvKeyBase(keyBase);
  if (values.length === 1) {
    return `${base}=${escapeEnvValue(values[0])}`;
  }

  return values
    .map((value, index) => `${base}_${index + 1}=${escapeEnvValue(value)}`)
    .join("\n");
}

export function buildTimestamp(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, "").replace(/:/g, "-");
}

export function downloadBlob(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
