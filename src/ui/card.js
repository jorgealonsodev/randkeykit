import { formatCrackTime } from "../crypto/crack-time.js";
import { clearClipboard } from "./clipboard.js";
import { buildCsv, buildEnv, buildText, buildTimestamp, downloadBlob } from "./export.js";
import { qrToSvg } from "../crypto/qrcode.js";

let cardInstanceId = 0;

function toInputValue(value) {
  return typeof value === "number" ? String(value) : value;
}

function resolveControlValue(control, defaults) {
  return defaults[control.param] ?? control.default;
}

function setEntropyBadgeContent(badge, entropy, showCrackTime) {
  let text = `~${entropy} bits`;
  if (showCrackTime) {
    text += ` · ${formatCrackTime(entropy)}`;
  }
  badge.textContent = text;
}

function setToast(message, onToast) {
  if (typeof onToast === "function") {
    onToast(message);
  }
}

function maskValue(value) {
  return [...value].map((character) => (character === "\n" ? "\n" : "•")).join("");
}

function normalizeResult(result) {
  if (Array.isArray(result)) {
    return { values: result.map(String) };
  }

  if (typeof result === "string") {
    return { values: [result] };
  }

  if (result && Array.isArray(result.values)) {
    return {
      ...result,
      values: result.values.map(String),
      outputs: Array.isArray(result.outputs)
        ? result.outputs.map((output) => ({ ...output, label: String(output.label), value: String(output.value) }))
        : undefined,
    };
  }

  if (result && Array.isArray(result.outputs)) {
    return {
      ...result,
      outputs: result.outputs.map((output) => ({ ...output, label: String(output.label), value: String(output.value) })),
      values: result.values?.map(String)
        ?? result.outputs.map((output) => String(output.value)),
    };
  }

  return {
    ...(result || {}),
    values: result?.value !== undefined ? [String(result.value)] : [],
  };
}

async function resolveBatchResult(config, params) {
  const batchCount = config.batchable ? Number(params.batchCount ?? 1) : 1;

  if (batchCount < 1 || batchCount > 100) {
    throw new Error(`Batch count must be 1–100, got ${batchCount}`);
  }

  const generatorParams = { ...params };
  delete generatorParams.batchCount;

  if (batchCount === 1) {
    return normalizeResult(await Promise.resolve(config.generator(generatorParams)));
  }

  const values = [];
  let entropy;
  let extras = {};

  for (let i = 0; i < batchCount; i += 1) {
    const result = normalizeResult(await Promise.resolve(config.generator(generatorParams)));
    values.push(...result.values);
    if (entropy === undefined && result.entropy !== undefined) {
      entropy = result.entropy;
    }
    if (i === 0) {
      extras = { ...result };
      delete extras.value;
      delete extras.values;
    }
  }

  return { ...extras, values, entropy };
}

function buildRangeUnit(control) {
  // Determine display unit from hint or param name
  const hint = control.hint || "";
  if (hint === "count" || control.param === "words") return " words";
  if (hint === "size" || control.param === "bytes") return " bytes";
  return " chars";
}

function createControlElement(control, defaults, onParamChange) {
  if (control.type === "checkbox-group") {
    const section = document.createElement("div");
    section.className = "space-y-3";

    const heading = document.createElement("div");
    heading.className = "font-label-caps text-label-caps text-secondary";
    heading.textContent = control.label;
    section.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "grid grid-cols-2 gap-y-2";

    control.options.forEach((option) => {
      const item = document.createElement("label");
      item.className = "flex items-center gap-2 cursor-pointer";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "rounded text-primary focus:ring-primary";
      input.checked = Boolean(defaults[option.param] ?? option.default);
      input.addEventListener("change", () => {
        onParamChange(option.param, input.checked);
      });

      const text = document.createElement("span");
      text.className = "text-body-sm";
      text.textContent = option.label;

      item.append(input, text);
      grid.appendChild(item);
    });

    section.appendChild(grid);
    return section;
  }

  const value = resolveControlValue(control, defaults);

  switch (control.type) {
    case "range": {
      const wrapper = document.createElement("div");

      const header = document.createElement("div");
      header.className = "flex justify-between mb-2";

      const label = document.createElement("label");
      label.className = "font-label-caps text-label-caps text-secondary";
      label.textContent = control.label.toUpperCase();

      const unit = buildRangeUnit(control);
      const valueDisplay = document.createElement("span");
      valueDisplay.className = "text-primary font-bold";
      valueDisplay.textContent = String(value) + unit;

      header.append(label, valueDisplay);
      wrapper.appendChild(header);

      const input = document.createElement("input");
      input.type = "range";
      input.className = "rand-range w-full";
      input.min = String(control.min);
      input.max = String(control.max);
      input.step = String(control.step || 1);
      input.value = String(value);
      input.addEventListener("input", () => {
        valueDisplay.textContent = input.value + unit;
        onParamChange(control.param, Number(input.value));
      });

      wrapper.appendChild(input);
      return wrapper;
    }

    case "select": {
      const wrapper = document.createElement("div");

      const label = document.createElement("label");
      label.className = "block font-label-caps text-label-caps text-secondary mb-2";
      label.textContent = control.label.toUpperCase();
      wrapper.appendChild(label);

      const select = document.createElement("select");
      select.className = "w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-body-sm outline-none focus:ring-2 focus:ring-primary/20";
      control.options.forEach((option) => {
        const element = document.createElement("option");
        element.value = String(option.value);
        element.textContent = option.label;
        element.selected = String(option.value) === String(value);
        select.appendChild(element);
      });
      select.addEventListener("change", () => {
        onParamChange(control.param, control.parse ? control.parse(select.value) : select.value);
      });

      wrapper.appendChild(select);
      return wrapper;
    }

    case "text": {
      const wrapper = document.createElement("div");

      const label = document.createElement("label");
      label.className = "block font-label-caps text-label-caps text-secondary mb-2";
      label.textContent = control.label.toUpperCase();
      wrapper.appendChild(label);

      const input = document.createElement("input");
      input.type = "text";
      input.className = "w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-body-sm outline-none focus:ring-2 focus:ring-primary/20";
      input.value = String(value ?? "");
      input.placeholder = control.placeholder || "";
      input.addEventListener("input", () => {
        onParamChange(control.param, input.value);
      });

      wrapper.appendChild(input);
      return wrapper;
    }

    case "checkbox": {
      const wrapper = document.createElement("div");

      const item = document.createElement("label");
      item.className = "flex items-center gap-2 cursor-pointer pt-2 border-t border-outline-variant/30";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "rounded text-primary focus:ring-primary";
      input.checked = Boolean(value);
      input.addEventListener("change", () => {
        onParamChange(control.param, input.checked);
      });

      const text = document.createElement("div");
      const name = document.createElement("span");
      name.className = "text-body-sm";
      name.textContent = control.label;
      text.appendChild(name);

      if (control.description) {
        const description = document.createElement("span");
        description.className = "text-body-sm text-secondary block";
        description.textContent = control.description;
        text.appendChild(description);
      }

      item.append(input, text);
      wrapper.appendChild(item);
      return wrapper;
    }

    default: {
      const wrapper = document.createElement("div");
      return wrapper;
    }
  }
}

export function createGeneratorCard(config, copyToClipboard, onToast, onGenerate) {
  const instanceId = ++cardInstanceId;
  const onCopy = config.onCopy || null;
  const autoClearMs = config.autoClearMs || (() => 0);
  const showCrackTime = config.showCrackTime || false;
  const exportKeyName = config.exportKeyName || config.id;

  const card = document.createElement("section");
  card.className = "scroll-mt-24 bg-white border border-outline-variant rounded-xl p-6 shadow-sm card-hover flex flex-col transition-all";
  card.id = config.id;
  card.setAttribute("aria-labelledby", `${config.id}-title`);
  if (config.category) {
    card.dataset.category = config.category;
  }

  const params = Object.fromEntries(Object.entries(config.defaults).map(([key, value]) => [key, toInputValue(value)]));

  Object.keys(config.defaults).forEach((key) => {
    const original = config.defaults[key];
    if (typeof original === "number" || typeof original === "boolean") {
      params[key] = original;
    }
  });

  // --- Header ---
  const header = document.createElement("div");
  header.className = "flex justify-between items-center mb-6";

  const identity = document.createElement("div");
  identity.className = "flex items-center gap-3";

  const iconTile = document.createElement("div");
  iconTile.className = "w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary";
  iconTile.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">${config.icon || "key"}</span>`;

  const title = document.createElement("h3");
  title.id = `${config.id}-title`;
  title.className = "font-headline-md text-headline-md";
  title.textContent = config.title;

  identity.append(iconTile, title);
  header.appendChild(identity);

  let entropyBadge = null;
  if (config.showEntropy) {
    entropyBadge = document.createElement("div");
    entropyBadge.className = "px-3 py-1 bg-tertiary-container/20 text-tertiary rounded-full font-label-caps text-label-caps";
    if (typeof config.entropy === "function") {
      setEntropyBadgeContent(entropyBadge, config.entropy(params), showCrackTime);
    }
    header.appendChild(entropyBadge);
  }

  card.appendChild(header);

  if (config.batchable) {
    const batchRow = document.createElement("div");
    batchRow.className = "mb-4 flex items-center gap-3";

    const batchLabel = document.createElement("label");
    batchLabel.className = "font-label-caps text-label-caps text-secondary";
    batchLabel.textContent = "COUNT";

    const batchSelect = document.createElement("select");
    batchSelect.className = "rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-body-sm outline-none focus:ring-2 focus:ring-primary/20";
    batchSelect.setAttribute("aria-label", `${config.title} batch count`);
    [1, 5, 10, 25, 50, 100].forEach((optionValue) => {
      const option = document.createElement("option");
      option.value = String(optionValue);
      option.textContent = String(optionValue);
      option.selected = Number(params.batchCount ?? 1) === optionValue;
      batchSelect.appendChild(option);
    });
    batchSelect.addEventListener("change", () => {
      params.batchCount = Number(batchSelect.value);
    });

    batchRow.append(batchLabel, batchSelect);
    card.appendChild(batchRow);
  }

  // --- Controls ---
  const controls = document.createElement("div");
  controls.className = "space-y-4 mb-6";

  function onParamChange(key, value) {
    params[key] = value;
    if (entropyBadge && typeof config.entropy === "function") {
      setEntropyBadgeContent(entropyBadge, config.entropy(params), showCrackTime);
    }
    // Update "All 4 groups required" label for password card
    if (groupsRequiredLabel) {
      updateGroupsRequiredLabel();
    }
  }

  config.controls.forEach((control) => {
    controls.appendChild(createControlElement(control, params, onParamChange));
  });
  card.appendChild(controls);

  // --- "All 4 character groups required" label (password card only) ---
  let groupsRequiredLabel = null;
  const groupParams = ["uppercase", "lowercase", "digits", "symbols"];
  const hasAllGroupParams = groupParams.every((p) => p in params);

  if (hasAllGroupParams) {
    groupsRequiredLabel = document.createElement("div");
    groupsRequiredLabel.className = "text-body-sm text-tertiary font-bold mb-4";
    groupsRequiredLabel.setAttribute("aria-live", "polite");

    function updateGroupsRequiredLabel() {
      const allOn = groupParams.every((p) => params[p]);
      groupsRequiredLabel.textContent = allOn ? "All 4 character groups required" : "";
      groupsRequiredLabel.hidden = !allOn;
    }

    updateGroupsRequiredLabel();
    card.appendChild(groupsRequiredLabel);
  }

  // --- Output ---
  // The placeholder is a sentence, so it renders small and muted; an actual
  // generated value switches to the large monospace style meant for keys.
  const PLACEHOLDER_TEXT = "Generate a new value to preview it here.";
  const OUTPUT_BASE_CLASS = "block bg-slate-50 border border-dashed border-outline-variant rounded-lg p-3 pr-10 text-center break-all mb-4 select-all";
  const OUTPUT_PLACEHOLDER_CLASS = "font-body-sm text-body-sm text-on-surface-variant";
  const OUTPUT_VALUE_CLASS = "font-mono-output text-mono-output text-on-surface";

  // Closure variable: always holds the real generated value (never masked text)
  let currentValue = "";
  let currentValues = [];
  let currentOutputBlocks = [];
  let valueHidden = false;
  let autoClearTimer = null;
  let availabilitySupported = true;

  const resultOutput = document.createElement("output");
  resultOutput.setAttribute("aria-live", "polite");

  const outputRegion = document.createElement("div");
  outputRegion.className = "relative";

  const structuredOutputs = document.createElement("div");
  structuredOutputs.className = "mb-4 space-y-3";
  structuredOutputs.hidden = true;

  function renderStructuredOutputs() {
    structuredOutputs.innerHTML = "";

    currentOutputBlocks.forEach((block) => {
      const wrapper = document.createElement("section");
      wrapper.className = "rounded-lg border border-outline-variant bg-slate-50 p-3 text-left";

      const label = document.createElement("p");
      label.className = "mb-2 font-label-caps text-label-caps text-secondary";
      label.textContent = block.label;

      const value = document.createElement("pre");
      value.className = "max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono-output text-body-sm text-on-surface";
      value.textContent = valueHidden ? maskValue(block.value) : block.value;

      wrapper.append(label, value);
      structuredOutputs.appendChild(wrapper);
    });
  }

  function showPlaceholder() {
    currentValue = "";
    currentValues = [];
    currentOutputBlocks = [];
    resultOutput.className = `${OUTPUT_BASE_CLASS} ${OUTPUT_PLACEHOLDER_CLASS}`;
    resultOutput.textContent = PLACEHOLDER_TEXT;
    resultOutput.hidden = false;
    structuredOutputs.hidden = true;
    structuredOutputs.innerHTML = "";
  }

  function showValue(values, outputBlocks = []) {
    currentValues = values;
    currentValue = values.join("\n");
    currentOutputBlocks = outputBlocks;
    resultOutput.className = `${OUTPUT_BASE_CLASS} ${OUTPUT_VALUE_CLASS}`;
    resultOutput.classList.toggle("whitespace-pre-wrap", values.length > 1);
    resultOutput.classList.toggle("text-left", values.length > 1);
    resultOutput.classList.toggle("max-h-56", values.length > 1);
    resultOutput.classList.toggle("overflow-auto", values.length > 1);
    if (outputBlocks.length > 0) {
      resultOutput.hidden = true;
      structuredOutputs.hidden = false;
      renderStructuredOutputs();
    } else {
      resultOutput.hidden = false;
      structuredOutputs.hidden = true;
      resultOutput.textContent = valueHidden ? maskValue(currentValue) : currentValue;
    }
  }

  showPlaceholder();

  outputRegion.appendChild(resultOutput);
  outputRegion.appendChild(structuredOutputs);

  // Show/hide toggle button
  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.dataset.action = "toggle-visibility";
  toggleButton.className = "absolute top-2 right-2 p-1 rounded text-on-surface-variant hover:text-on-surface transition-colors focus-visible:ring-2 focus-visible:ring-primary/40";
  toggleButton.setAttribute("aria-label", "Hide value");
  toggleButton.innerHTML = `<span class="material-symbols-outlined text-[20px]" aria-hidden="true">visibility</span>`;
  toggleButton.hidden = true; // Hidden until a value is generated

  toggleButton.addEventListener("click", () => {
    valueHidden = !valueHidden;
    if (currentOutputBlocks.length > 0) {
      renderStructuredOutputs();
    } else {
      resultOutput.textContent = valueHidden ? maskValue(currentValue) : currentValue;
    }
    toggleButton.setAttribute("aria-label", valueHidden ? "Show value" : "Hide value");
    toggleButton.innerHTML = valueHidden
      ? `<span class="material-symbols-outlined text-[20px]" aria-hidden="true">visibility_off</span>`
      : `<span class="material-symbols-outlined text-[20px]" aria-hidden="true">visibility</span>`;
  });

  outputRegion.appendChild(toggleButton);
  card.appendChild(outputRegion);


  // --- Error area ---
  const errorArea = document.createElement("div");
  errorArea.className = "bg-error-container text-on-error-container rounded-lg px-4 py-3 text-body-sm mb-4";
  errorArea.setAttribute("role", "alert");
  errorArea.hidden = true;
  card.appendChild(errorArea);

  const availabilityNote = document.createElement("p");
  availabilityNote.className = "mb-4 text-body-sm text-secondary";
  availabilityNote.hidden = true;
  card.appendChild(availabilityNote);

  // --- Actions ---
  const actions = document.createElement("div");
  actions.className = "flex gap-2 mt-auto";

  const generateButton = document.createElement("button");
  generateButton.type = "button";
  generateButton.dataset.action = "generate";
  generateButton.className = "flex-1 py-3 bg-primary text-white rounded-lg font-bold active:scale-95 transition-all";
  generateButton.textContent = "Generate";
  generateButton.setAttribute("aria-label", "Generate new value");

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.dataset.action = "copy";
  copyButton.className = "px-4 py-3 border border-outline-variant rounded-lg hover:bg-slate-50 transition-all";
  copyButton.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">content_copy</span>`;
  copyButton.setAttribute("aria-label", "Copy to clipboard");
  copyButton.disabled = true;

  // --- Export dropdown ---
  const exportWrapper = document.createElement("div");
  exportWrapper.className = "relative";

  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.dataset.action = "export";
  exportButton.className = "px-3 py-3 border border-outline-variant rounded-lg hover:bg-slate-50 transition-all text-body-sm flex items-center gap-1";
  exportButton.disabled = true;
  exportButton.setAttribute("aria-haspopup", "menu");
  exportButton.setAttribute("aria-expanded", "false");
  exportButton.innerHTML = `Export <span class="material-symbols-outlined text-[16px]" aria-hidden="true">expand_more</span>`;

  const exportMenu = document.createElement("div");
  exportMenu.setAttribute("role", "menu");
  exportMenu.className = "absolute right-0 mt-1 w-max min-w-[8rem] bg-white border border-outline-variant rounded-lg shadow-lg p-1 flex flex-col z-20";
  exportMenu.hidden = true;

  const exportTxtButton = document.createElement("button");
  exportTxtButton.type = "button";
  exportTxtButton.dataset.action = "export-txt";
  exportTxtButton.setAttribute("role", "menuitem");
  exportTxtButton.className = "px-3 py-2 text-body-sm text-left whitespace-nowrap hover:bg-slate-50 rounded transition-all";
  exportTxtButton.textContent = "Export TXT";

  const exportCsvButton = document.createElement("button");
  exportCsvButton.type = "button";
  exportCsvButton.dataset.action = "export-csv";
  exportCsvButton.setAttribute("role", "menuitem");
  exportCsvButton.className = exportTxtButton.className;
  exportCsvButton.textContent = "Export CSV";

  const exportEnvButton = document.createElement("button");
  exportEnvButton.type = "button";
  exportEnvButton.dataset.action = "export-env";
  exportEnvButton.setAttribute("role", "menuitem");
  exportEnvButton.className = exportTxtButton.className;
  exportEnvButton.textContent = "Export ENV";

  exportMenu.append(exportTxtButton, exportCsvButton, exportEnvButton);
  exportWrapper.append(exportButton, exportMenu);

  actions.className = "flex flex-wrap gap-2 mt-auto";
  actions.append(generateButton, copyButton, exportWrapper);
  card.appendChild(actions);

  // --- QR code toggle ---
  const qrToggleButton = document.createElement("button");
  qrToggleButton.type = "button";
  qrToggleButton.dataset.action = "toggle-qr";
  qrToggleButton.setAttribute("aria-expanded", "false");
  const qrContainerId = `qr-container-${config.id}-${instanceId}`;
  qrToggleButton.setAttribute("aria-controls", qrContainerId);
  qrToggleButton.className = "mt-2 w-full py-2 border border-outline-variant rounded-lg text-body-sm hover:bg-slate-50 transition-all";
  qrToggleButton.textContent = "Show QR";
  qrToggleButton.hidden = true;
  card.appendChild(qrToggleButton);

  const qrContainer = document.createElement("div");
  qrContainer.id = qrContainerId;
  qrContainer.setAttribute("role", "img");
  qrContainer.setAttribute("aria-label", "QR code");
  qrContainer.className = "mt-2 flex justify-center";
  qrContainer.hidden = true;
  card.appendChild(qrContainer);

  function resetQr() {
    qrToggleButton.hidden = true;
    qrToggleButton.setAttribute("aria-expanded", "false");
    qrToggleButton.textContent = "Show QR";
    qrContainer.hidden = true;
    qrContainer.innerHTML = "";
  }

  qrToggleButton.addEventListener("click", () => {
    const expanded = qrToggleButton.getAttribute("aria-expanded") === "true";
    qrToggleButton.setAttribute("aria-expanded", String(!expanded));
    qrContainer.hidden = expanded;
    qrToggleButton.textContent = expanded ? "Show QR" : "Hide QR";
  });

  function getFilename(extension) {
    return `${config.id}-${buildTimestamp()}.${extension}`;
  }

  function setExportEnabled(enabled) {
    exportButton.disabled = !enabled;
    if (!enabled) {
      exportMenu.hidden = true;
      exportButton.setAttribute("aria-expanded", "false");
    }
  }

  function setAvailability({ supported = true, message = "" } = {}) {
    availabilitySupported = supported;
    availabilityNote.hidden = supported || !message;
    availabilityNote.textContent = message;

    if (!supported) {
      generateButton.disabled = true;
      copyButton.disabled = true;
      setExportEnabled(false);
      toggleButton.hidden = true;
      resetQr();
      showPlaceholder();
    } else {
      generateButton.disabled = false;
    }
  }

  // --- Generate logic ---
  async function generateValue() {
    try {
      if (!availabilitySupported) {
        throw new Error(availabilityNote.textContent || `${config.title} is unavailable in this browser.`);
      }
      errorArea.hidden = true;
      generateButton.disabled = true;
      generateButton.innerHTML = `<span class="material-symbols-outlined animate-spin" aria-hidden="true">progress_activity</span>`;

      const result = await resolveBatchResult(config, params);
      showValue(result.values, result.outputs || []);
      copyButton.disabled = false;
      setExportEnabled(result.outputs?.length ? false : true);
      toggleButton.hidden = false;

      // Reset visibility on new generation
      valueHidden = false;
      toggleButton.setAttribute("aria-label", "Hide value");
      toggleButton.innerHTML = `<span class="material-symbols-outlined text-[20px]" aria-hidden="true">visibility</span>`;

      if (typeof onGenerate === "function") {
        onGenerate(result);
      }

      if (entropyBadge && result.entropy !== undefined) {
        setEntropyBadgeContent(entropyBadge, result.entropy, showCrackTime);
      }

      // --- QR viability check ---
      resetQr();
      const batchCount = config.batchable ? Number(params.batchCount ?? 1) : 1;
      const isSingleValue = result.values.length === 1;
      const qrPayload = isSingleValue
        ? (typeof config.qrValue === "function"
          ? config.qrValue(result, params)
          : (batchCount === 1 ? result.values[0] : null))
        : null;

      if (qrPayload) {
        try {
          const svg = qrToSvg(qrPayload);
          qrContainer.innerHTML = svg;
          qrToggleButton.hidden = false;
        } catch {
          // payload too long for QR — keep button hidden
        }
      }

      return result;
    } catch (error) {
      showPlaceholder();
      toggleButton.hidden = true;
      resetQr();
      errorArea.textContent = error.message || "Generation failed";
      errorArea.hidden = false;
      copyButton.disabled = true;
      setExportEnabled(false);
      throw error;
    } finally {
      generateButton.disabled = false;
      generateButton.textContent = "Generate";
    }
  }

  generateButton.addEventListener("click", () => {
    void generateValue().catch(() => {});
  });

  copyButton.addEventListener("click", async () => {
    if (!currentValue) {
      return;
    }

    const success = await copyToClipboard(currentValue);
    if (!success) {
      setToast(`Copy failed for ${config.title}.`, onToast);
      return;
    }

    // Push to history
    if (typeof onCopy === "function") {
      onCopy({ value: currentValue, timestamp: new Date(), source: config.title, count: currentValues.length || 1 });
    }

    // Schedule auto-clear
    if (autoClearTimer) {
      clearTimeout(autoClearTimer);
      autoClearTimer = null;
    }
    const clearMs = autoClearMs();
    if (clearMs > 0) {
      autoClearTimer = setTimeout(() => {
        clearClipboard();
        autoClearTimer = null;
      }, clearMs);
    }

    copyButton.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">check</span>`;
    copyButton.classList.add("border-tertiary/30", "bg-tertiary/10", "text-tertiary");
    setToast(`${config.title} copied to clipboard.`, onToast);

    setTimeout(() => {
      copyButton.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">content_copy</span>`;
      copyButton.classList.remove("border-tertiary/30", "bg-tertiary/10", "text-tertiary");
    }, 1500);
  });

  exportButton.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = exportMenu.hidden === false;
    exportMenu.hidden = isOpen;
    exportButton.setAttribute("aria-expanded", String(!isOpen));
    if (isOpen === false) {
      // Menu just opened — move focus to the first menuitem
      const firstItem = exportMenu.querySelector('[role="menuitem"]');
      if (firstItem) firstItem.focus();
    }
  });

  // Close on Escape — return focus to trigger button
  card.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !exportMenu.hidden) {
      exportMenu.hidden = true;
      exportButton.setAttribute("aria-expanded", "false");
      exportButton.focus();
    }
  });

  // Close on outside click — use AbortController so the listener can be cleaned up
  const abortController = new AbortController();
  document.addEventListener("click", function closeExportMenu(e) {
    if (!exportWrapper.contains(e.target)) {
      exportMenu.hidden = true;
      exportButton.setAttribute("aria-expanded", "false");
    }
  }, { capture: true, signal: abortController.signal });

  exportTxtButton.addEventListener("click", () => {
    if (currentValues.length === 0) return;
    exportMenu.hidden = true;
    exportButton.setAttribute("aria-expanded", "false");
    downloadBlob(getFilename("txt"), "text/plain;charset=utf-8", buildText(currentValues));
    setToast(`${config.title} exported as TXT.`, onToast);
  });

  exportCsvButton.addEventListener("click", () => {
    if (currentValues.length === 0) return;
    exportMenu.hidden = true;
    exportButton.setAttribute("aria-expanded", "false");
    downloadBlob(getFilename("csv"), "text/csv;charset=utf-8", buildCsv(currentValues));
    setToast(`${config.title} exported as CSV.`, onToast);
  });

  exportEnvButton.addEventListener("click", () => {
    if (currentValues.length === 0) return;
    exportMenu.hidden = true;
    exportButton.setAttribute("aria-expanded", "false");
    downloadBlob(getFilename("env"), "text/plain;charset=utf-8", buildEnv(currentValues, exportKeyName));
    setToast(`${config.title} exported as ENV.`, onToast);
  });

  card.generateValue = generateValue;
  card.setAvailability = setAvailability;
  card.destroy = () => abortController.abort();
  return card;
}
