/**
 * Generator card factory.
 * Creates a DOM card element from a configuration object.
 *
 * Config contract:
 * {
 *   id: string,           // DOM identifier prefix
 *   title: string,        // Display name
 *   description: string,  // Brief explanation
 *   generator: Function,  // async or sync generator returning { value, entropy? }
 *   defaults: Object,     // Default parameter values
 *   controls: Array,      // Control definitions
 *   showEntropy: boolean  // Whether to display entropy badge
 * }
 */

function createControlElement(control, defaults, onParamChange) {
  const container = document.createElement("div");
  container.className = "card-control-group";

  switch (control.type) {
    case "range": {
      const label = document.createElement("label");
      const span = document.createElement("span");
      span.textContent = `${control.label}: `;
      const valueDisplay = document.createElement("span");
      valueDisplay.className = "range-value";
      valueDisplay.textContent = String(defaults[control.param] ?? control.default);
      label.appendChild(span);
      label.appendChild(valueDisplay);

      const input = document.createElement("input");
      input.type = "range";
      input.min = String(control.min);
      input.max = String(control.max);
      input.step = String(control.step || 1);
      input.value = String(defaults[control.param] ?? control.default);
      input.addEventListener("input", () => {
        valueDisplay.textContent = input.value;
        onParamChange(control.param, Number(input.value));
      });

      container.appendChild(label);
      container.appendChild(input);
      break;
    }

    case "select": {
      const label = document.createElement("label");
      label.textContent = `${control.label}: `;

      const select = document.createElement("select");
      control.options.forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt.value;
        option.textContent = opt.label;
        select.appendChild(option);
      });
      select.value = String(defaults[control.param] ?? control.default);
      select.addEventListener("change", () => {
        onParamChange(control.param, select.value);
      });

      label.appendChild(select);
      container.appendChild(label);
      break;
    }

    case "text": {
      const label = document.createElement("label");
      label.textContent = `${control.label}: `;

      const input = document.createElement("input");
      input.type = "text";
      input.value = String(defaults[control.param] ?? "");
      input.placeholder = control.placeholder || "";
      input.addEventListener("input", () => {
        onParamChange(control.param, input.value);
      });

      label.appendChild(input);
      container.appendChild(label);
      break;
    }

    case "checkbox": {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = Boolean(defaults[control.param] ?? control.default);
      input.addEventListener("change", () => {
        onParamChange(control.param, input.checked);
      });

      label.appendChild(input);
      label.appendChild(document.createTextNode(` ${control.label}`));
      container.appendChild(label);
      break;
    }

    default:
      break;
  }

  return container;
}

/**
 * Creates a generator card and appends it to the DOM.
 * @param {Object} config - Card configuration
 * @param {Object} copyToClipboard - Clipboard function reference
 * @returns {HTMLElement} The created card element
 */
export function createGeneratorCard(config, copyToClipboard) {
  const card = document.createElement("section");
  card.className = "generator-card";
  card.setAttribute("aria-labelledby", `${config.id}-title`);

  // Title
  const title = document.createElement("h2");
  title.id = `${config.id}-title`;
  title.className = "card-title";
  title.textContent = config.title;
  card.appendChild(title);

  // Description
  const desc = document.createElement("p");
  desc.className = "card-desc";
  desc.textContent = config.description;
  card.appendChild(desc);

  // Controls
  const controlsContainer = document.createElement("div");
  controlsContainer.className = "card-controls";
  card.appendChild(controlsContainer);

  // Active params (clone defaults)
  const params = { ...config.defaults };

  function onParamChange(key, value) {
    params[key] = value;
    if (entropyBadge && typeof config.entropy === "function") {
      const entropy = config.entropy(params);
      entropyBadge.innerHTML = `Entropy: <span class="entropy-value">~${entropy} bits</span>`;
    }
  }

  // Render controls
  if (config.controls) {
    config.controls.forEach((ctrl) => {
      const el = createControlElement(ctrl, params, onParamChange);
      controlsContainer.appendChild(el);
    });
  }

  // Result output
  const resultOutput = document.createElement("output");
  resultOutput.className = "result-output";
  resultOutput.setAttribute("aria-live", "polite");
  card.appendChild(resultOutput);

  // Actions row
  const actions = document.createElement("div");
  actions.className = "card-actions";

  const generateBtn = document.createElement("button");
  generateBtn.className = "btn btn-primary";
  generateBtn.textContent = "Generate";
  generateBtn.type = "button";

  const copyBtn = document.createElement("button");
  copyBtn.className = "btn btn-secondary";
  copyBtn.textContent = "Copy";
  copyBtn.type = "button";

  // Entropy badge (if applicable)
  let entropyBadge = null;
  if (config.showEntropy) {
    entropyBadge = document.createElement("span");
    entropyBadge.className = "entropy-badge";
    if (typeof config.entropy === "function") {
      const initialEntropy = config.entropy(config.defaults);
      entropyBadge.innerHTML = `Entropy: <span class="entropy-value">~${initialEntropy} bits</span>`;
    }
    actions.appendChild(entropyBadge);
  }

  actions.appendChild(generateBtn);
  actions.appendChild(copyBtn);
  card.appendChild(actions);

  // Error display area
  const errorArea = document.createElement("div");
  errorArea.className = "card-error";
  errorArea.setAttribute("role", "alert");
  errorArea.hidden = true;
  card.appendChild(errorArea);

  // Generate handler
  generateBtn.addEventListener("click", async () => {
    try {
      errorArea.hidden = true;
      generateBtn.disabled = true;
      generateBtn.textContent = "Generating...";

      const result = await Promise.resolve(config.generator(params));

      if (result && result.value !== undefined) {
        resultOutput.textContent = result.value;
        resultOutput.classList.remove("copied-flash");

        if (entropyBadge && result.entropy !== undefined) {
          entropyBadge.innerHTML = `Entropy: <span class="entropy-value">~${result.entropy} bits</span>`;
        }
      }
    } catch (err) {
      resultOutput.textContent = "";
      errorArea.textContent = err.message || "Generation failed";
      errorArea.hidden = false;
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate";
    }
  });

  // Copy handler
  copyBtn.addEventListener("click", async () => {
    const value = resultOutput.textContent;
    if (!value) return;

    const success = await copyToClipboard(value);
    if (success) {
      copyBtn.textContent = "Copied!";
      copyBtn.classList.add("btn-primary");
      copyBtn.classList.remove("btn-secondary");
      resultOutput.classList.add("copied-flash");
      setTimeout(() => {
        copyBtn.textContent = "Copy";
        copyBtn.classList.add("btn-secondary");
        copyBtn.classList.remove("btn-primary");
        resultOutput.classList.remove("copied-flash");
      }, 1500);
    }
  });

  return card;
}
