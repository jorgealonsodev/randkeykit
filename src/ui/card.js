function toInputValue(value) {
  return typeof value === "number" ? String(value) : value;
}

function resolveControlValue(control, defaults) {
  return defaults[control.param] ?? control.default;
}

function setEntropyBadgeContent(badge, entropy) {
  badge.textContent = `~${entropy} bits`;
}

function setToast(message, onToast) {
  if (typeof onToast === "function") {
    onToast(message);
  }
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
  const card = document.createElement("section");
  card.className = "bg-white border border-outline-variant rounded-xl p-6 shadow-sm card-hover flex flex-col transition-all";
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
  iconTile.innerHTML = `<span class="material-symbols-outlined">${config.icon || "key"}</span>`;

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
      setEntropyBadgeContent(entropyBadge, config.entropy(params));
    }
    header.appendChild(entropyBadge);
  }

  card.appendChild(header);

  // --- Controls ---
  const controls = document.createElement("div");
  controls.className = "space-y-4 mb-6";

  function onParamChange(key, value) {
    params[key] = value;
    if (entropyBadge && typeof config.entropy === "function") {
      setEntropyBadgeContent(entropyBadge, config.entropy(params));
    }
  }

  config.controls.forEach((control) => {
    controls.appendChild(createControlElement(control, params, onParamChange));
  });
  card.appendChild(controls);

  // --- Output ---
  // The placeholder is a sentence, so it renders small and muted; an actual
  // generated value switches to the large monospace style meant for keys.
  const PLACEHOLDER_TEXT = "Generate a new value to preview it here.";
  const OUTPUT_BASE_CLASS = "bg-slate-50 border border-dashed border-outline-variant rounded-lg p-3 text-center break-all mb-4 select-all";
  const OUTPUT_PLACEHOLDER_CLASS = "font-body-sm text-body-sm text-on-surface-variant";
  const OUTPUT_VALUE_CLASS = "font-mono-output text-mono-output text-on-surface";

  const resultOutput = document.createElement("output");
  resultOutput.setAttribute("aria-live", "polite");

  function showPlaceholder() {
    resultOutput.className = `${OUTPUT_BASE_CLASS} ${OUTPUT_PLACEHOLDER_CLASS}`;
    resultOutput.textContent = PLACEHOLDER_TEXT;
  }

  function showValue(value) {
    resultOutput.className = `${OUTPUT_BASE_CLASS} ${OUTPUT_VALUE_CLASS}`;
    resultOutput.textContent = value;
  }

  showPlaceholder();
  card.appendChild(resultOutput);

  // --- Error area ---
  const errorArea = document.createElement("div");
  errorArea.className = "bg-error-container text-on-error-container rounded-lg px-4 py-3 text-body-sm mb-4";
  errorArea.setAttribute("role", "alert");
  errorArea.hidden = true;
  card.appendChild(errorArea);

  // --- Actions ---
  const actions = document.createElement("div");
  actions.className = "flex gap-2 mt-auto";

  const generateButton = document.createElement("button");
  generateButton.type = "button";
  generateButton.dataset.action = "generate";
  generateButton.className = "flex-1 py-3 bg-primary text-white rounded-lg font-bold active:scale-95 transition-all";
  generateButton.textContent = "Generate";

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.dataset.action = "copy";
  copyButton.className = "px-4 py-3 border border-outline-variant rounded-lg hover:bg-slate-50 transition-all";
  copyButton.innerHTML = `<span class="material-symbols-outlined">content_copy</span>`;
  copyButton.disabled = true;

  actions.append(generateButton, copyButton);
  card.appendChild(actions);

  // --- Generate logic ---
  async function generateValue() {
    try {
      errorArea.hidden = true;
      generateButton.disabled = true;
      generateButton.innerHTML = `<span class="material-symbols-outlined animate-spin">progress_activity</span>`;

      const result = await Promise.resolve(config.generator(params));
      showValue(result.value);
      copyButton.disabled = false;

      if (typeof onGenerate === "function") {
        onGenerate(result);
      }

      if (entropyBadge && result.entropy !== undefined) {
        setEntropyBadgeContent(entropyBadge, result.entropy);
      }

      return result;
    } catch (error) {
      showPlaceholder();
      errorArea.textContent = error.message || "Generation failed";
      errorArea.hidden = false;
      copyButton.disabled = true;
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
    const value = resultOutput.textContent;
    if (!value || value === PLACEHOLDER_TEXT) {
      return;
    }

    const success = await copyToClipboard(value);
    if (!success) {
      setToast(`Copy failed for ${config.title}.`, onToast);
      return;
    }

    copyButton.innerHTML = `<span class="material-symbols-outlined">check</span>`;
    copyButton.classList.add("border-tertiary/30", "bg-tertiary/10", "text-tertiary");
    setToast(`${config.title} copied to clipboard.`, onToast);

    setTimeout(() => {
      copyButton.innerHTML = `<span class="material-symbols-outlined">content_copy</span>`;
      copyButton.classList.remove("border-tertiary/30", "bg-tertiary/10", "text-tertiary");
    }, 1500);
  });

  card.generateValue = generateValue;
  return card;
}
