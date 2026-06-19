function toInputValue(value) {
  return typeof value === "number" ? String(value) : value;
}

function resolveControlValue(control, defaults) {
  return defaults[control.param] ?? control.default;
}

function createFieldShell(title, hint) {
  const wrapper = document.createElement("div");
  wrapper.className = "space-y-2";

  const header = document.createElement("div");
  header.className = "flex items-center justify-between gap-3";

  const label = document.createElement("label");
  label.className = "text-xs font-medium uppercase tracking-[0.18em] text-slate-400";
  label.textContent = title;
  header.appendChild(label);

  if (hint) {
    const help = document.createElement("span");
    help.className = "text-xs text-slate-500";
    help.textContent = hint;
    header.appendChild(help);
  }

  wrapper.appendChild(header);
  return { wrapper, label };
}

function createControlElement(control, defaults, onParamChange) {
  if (control.type === "checkbox-group") {
    const section = document.createElement("div");
    section.className = "space-y-3";

    const heading = document.createElement("div");
    heading.className = "text-xs font-medium uppercase tracking-[0.18em] text-slate-400";
    heading.textContent = control.label;
    section.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "grid grid-cols-1 gap-2 sm:grid-cols-2";

    control.options.forEach((option) => {
      const item = document.createElement("label");
      item.className = "group flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/[0.05]";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-400 focus:ring-cyan-300/40";
      input.checked = Boolean(defaults[option.param] ?? option.default);
      input.addEventListener("change", () => {
        onParamChange(option.param, input.checked);
      });

      const text = document.createElement("div");
      text.className = "flex min-w-0 flex-col";
      const name = document.createElement("span");
      name.className = "font-medium text-slate-100";
      name.textContent = option.label;
      text.appendChild(name);

      if (option.description) {
        const description = document.createElement("span");
        description.className = "text-xs text-slate-500";
        description.textContent = option.description;
        text.appendChild(description);
      }

      item.append(input, text);
      grid.appendChild(item);
    });

    section.appendChild(grid);
    return section;
  }

  const value = resolveControlValue(control, defaults);
  const { wrapper, label } = createFieldShell(control.label, control.hint);

  switch (control.type) {
    case "range": {
      const valueDisplay = document.createElement("span");
      valueDisplay.className = "rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-100";
      valueDisplay.textContent = String(value);
      label.parentElement.appendChild(valueDisplay);

      const input = document.createElement("input");
      input.type = "range";
      input.className = "rand-range w-full";
      input.min = String(control.min);
      input.max = String(control.max);
      input.step = String(control.step || 1);
      input.value = String(value);
      input.addEventListener("input", () => {
        valueDisplay.textContent = input.value;
        onParamChange(control.param, Number(input.value));
      });

      wrapper.appendChild(input);
      return wrapper;
    }

    case "select": {
      const select = document.createElement("select");
      select.className = "w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20";
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
      const input = document.createElement("input");
      input.type = "text";
      input.className = "w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20";
      input.value = String(value ?? "");
      input.placeholder = control.placeholder || "";
      input.addEventListener("input", () => {
        onParamChange(control.param, input.value);
      });

      wrapper.appendChild(input);
      return wrapper;
    }

    case "checkbox": {
      const item = document.createElement("label");
      item.className = "flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/[0.05]";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "mt-0.5 h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-400 focus:ring-cyan-300/40";
      input.checked = Boolean(value);
      input.addEventListener("change", () => {
        onParamChange(control.param, input.checked);
      });

      const text = document.createElement("div");
      const name = document.createElement("span");
      name.className = "font-medium text-slate-100";
      name.textContent = control.label;
      text.appendChild(name);

      if (control.description) {
        const description = document.createElement("p");
        description.className = "mt-1 text-xs leading-5 text-slate-500";
        description.textContent = control.description;
        text.appendChild(description);
      }

      item.append(input, text);
      return item;
    }

    default:
      return wrapper;
  }
}

function setEntropyBadgeContent(badge, entropy) {
  badge.textContent = `~${entropy} bits`;
}

function setToast(message, onToast) {
  if (typeof onToast === "function") {
    onToast(message);
  }
}

export function createGeneratorCard(config, copyToClipboard, onToast) {
  const card = document.createElement("section");
  card.className = "card-hover relative flex h-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.88))] p-5 shadow-[0_18px_60px_rgba(2,6,23,0.28)] backdrop-blur sm:p-6";
  card.setAttribute("aria-labelledby", `${config.id}-title`);

  const params = Object.fromEntries(Object.entries(config.defaults).map(([key, value]) => [key, toInputValue(value)]));

  Object.keys(config.defaults).forEach((key) => {
    const original = config.defaults[key];
    if (typeof original === "number" || typeof original === "boolean") {
      params[key] = original;
    }
  });

  const header = document.createElement("div");
  header.className = "flex items-start justify-between gap-4";

  const identity = document.createElement("div");
  identity.className = "flex min-w-0 items-start gap-4";

  const iconTile = document.createElement("div");
  iconTile.className = "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 shadow-[0_0_40px_rgba(34,211,238,0.08)]";
  iconTile.innerHTML = `<span class="material-symbols-outlined text-[26px] text-cyan-100">${config.icon || "key"}</span>`;

  const titleBlock = document.createElement("div");
  titleBlock.className = "min-w-0";

  const title = document.createElement("h2");
  title.id = `${config.id}-title`;
  title.className = "font-display text-xl font-semibold tracking-tight text-white";
  title.textContent = config.title;

  const description = document.createElement("p");
  description.className = "mt-2 text-sm leading-6 text-slate-400";
  description.textContent = config.description;

  titleBlock.append(title, description);
  identity.append(iconTile, titleBlock);
  header.appendChild(identity);

  let entropyBadge = null;
  if (config.showEntropy) {
    entropyBadge = document.createElement("span");
    entropyBadge.className = "inline-flex shrink-0 items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100";
    if (typeof config.entropy === "function") {
      setEntropyBadgeContent(entropyBadge, config.entropy(params));
    }
    header.appendChild(entropyBadge);
  }

  card.appendChild(header);

  const controls = document.createElement("div");
  controls.className = "mt-6 space-y-4";

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

  const resultLabel = document.createElement("div");
  resultLabel.className = "mt-6 flex items-center justify-between gap-3";
  resultLabel.innerHTML = `<span class="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Generated output</span><span class="text-xs text-slate-500">Monospace preview</span>`;
  card.appendChild(resultLabel);

  const resultOutput = document.createElement("output");
  resultOutput.className = "mt-3 min-h-[112px] w-full overflow-x-auto rounded-[24px] border border-white/10 bg-slate-950/80 px-4 py-4 font-mono text-sm leading-7 tracking-[0.02em] text-cyan-100 shadow-inner shadow-black/20";
  resultOutput.setAttribute("aria-live", "polite");
  resultOutput.textContent = "Generate a new value to preview it here.";
  card.appendChild(resultOutput);

  const errorArea = document.createElement("div");
  errorArea.className = "mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100";
  errorArea.setAttribute("role", "alert");
  errorArea.hidden = true;
  card.appendChild(errorArea);

  const actions = document.createElement("div");
  actions.className = "mt-5 grid grid-cols-2 gap-3";

  const generateButton = document.createElement("button");
  generateButton.type = "button";
  generateButton.dataset.action = "generate";
  generateButton.className = "inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60";
  generateButton.innerHTML = `<span class="material-symbols-outlined text-lg">bolt</span><span>Generate</span>`;

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.dataset.action = "copy";
  copyButton.className = "inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50";
  copyButton.innerHTML = `<span class="material-symbols-outlined text-lg">content_copy</span><span>Copy</span>`;
  copyButton.disabled = true;

  actions.append(generateButton, copyButton);
  card.appendChild(actions);

  async function generateValue() {
    try {
      errorArea.hidden = true;
      generateButton.disabled = true;
      generateButton.innerHTML = `<span class="material-symbols-outlined animate-pulse text-lg">progress_activity</span><span>Generating…</span>`;

      const result = await Promise.resolve(config.generator(params));
      resultOutput.textContent = result.value;
      resultOutput.classList.remove("ring-2", "ring-emerald-300/30");
      copyButton.disabled = false;

      if (entropyBadge && result.entropy !== undefined) {
        setEntropyBadgeContent(entropyBadge, result.entropy);
      }

      return result;
    } catch (error) {
      resultOutput.textContent = "Generate a new value to preview it here.";
      errorArea.textContent = error.message || "Generation failed";
      errorArea.hidden = false;
      copyButton.disabled = true;
      throw error;
    } finally {
      generateButton.disabled = false;
      generateButton.innerHTML = `<span class="material-symbols-outlined text-lg">bolt</span><span>Generate</span>`;
    }
  }

  generateButton.addEventListener("click", () => {
    void generateValue().catch(() => {});
  });

  copyButton.addEventListener("click", async () => {
    const value = resultOutput.textContent;
    if (!value || value === "Generate a new value to preview it here.") {
      return;
    }

    const success = await copyToClipboard(value);
    if (!success) {
      setToast(`Copy failed for ${config.title}.`, onToast);
      return;
    }

    copyButton.innerHTML = `<span class="material-symbols-outlined text-lg">check</span><span>Copied</span>`;
    copyButton.classList.add("border-emerald-400/30", "bg-emerald-400/10", "text-emerald-100");
    resultOutput.classList.add("ring-2", "ring-emerald-300/30");
    setToast(`${config.title} copied to clipboard.`, onToast);

    setTimeout(() => {
      copyButton.innerHTML = `<span class="material-symbols-outlined text-lg">content_copy</span><span>Copy</span>`;
      copyButton.classList.remove("border-emerald-400/30", "bg-emerald-400/10", "text-emerald-100");
      resultOutput.classList.remove("ring-2", "ring-emerald-300/30");
    }, 1500);
  });

  card.generateValue = generateValue;
  return card;
}
