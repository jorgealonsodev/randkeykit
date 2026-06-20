import assert from "node:assert/strict";
import test from "node:test";
import { parseHTML } from "linkedom";

import { createGeneratorCard } from "../../src/ui/card.js";

const GENERATE_PLACEHOLDER = "Generate a new value to preview it here.";

function installDom() {
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
    HTMLSelectElement: globalThis.HTMLSelectElement,
    Event: globalThis.Event,
    KeyboardEvent: globalThis.KeyboardEvent,
    Node: globalThis.Node,
  };

  const { window } = parseHTML("<!doctype html><html><body></body></html>");

  // linkedom does not expose KeyboardEvent as a constructor; shim it.
  const LinkedomEvent = window.Event;
  function LinkedomKeyboardEvent(type, init = {}) {
    const ev = new LinkedomEvent(type, init);
    if (init.key !== undefined) {
      Object.defineProperty(ev, "key", { value: init.key, writable: false, configurable: true });
    }
    return ev;
  }
  LinkedomKeyboardEvent.prototype = LinkedomEvent.prototype;

  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.HTMLSelectElement = window.HTMLSelectElement;
  globalThis.Event = window.Event;
  globalThis.KeyboardEvent = LinkedomKeyboardEvent;
  globalThis.Node = window.Node;

  if (window.HTMLSelectElement) {
    Object.defineProperty(window.HTMLSelectElement.prototype, "value", {
      configurable: true,
      get() {
        return this.getAttribute("value") ?? this.querySelector("option[selected]")?.value ?? this.firstElementChild?.value ?? "";
      },
      set(value) {
        const nextValue = String(value);
        this.setAttribute("value", nextValue);
        [...this.querySelectorAll("option")].forEach((option) => {
          if (option.value === nextValue) {
            option.setAttribute("selected", "");
          } else {
            option.removeAttribute("selected");
          }
        });
      },
    });
  }

  return () => {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.HTMLElement = previous.HTMLElement;
    globalThis.HTMLSelectElement = previous.HTMLSelectElement;
    globalThis.Event = previous.Event;
    globalThis.KeyboardEvent = previous.KeyboardEvent;
    globalThis.Node = previous.Node;
  };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createTestConfig(generator) {
  return {
    id: "test-card",
    title: "Test Card",
    description: "Test description",
    defaults: {},
    controls: [],
    generator,
    showEntropy: false,
  };
}

test("card generate click shows error UI without leaking unhandled rejection", async () => {
  const restoreDom = installDom();
  const unhandledRejections = [];
  const onUnhandledRejection = (reason) => {
    unhandledRejections.push(reason);
  };

  process.on("unhandledRejection", onUnhandledRejection);

  try {
    const card = createGeneratorCard(
      createTestConfig(() => Promise.reject(new Error("boom"))),
      async () => true,
      () => {},
    );

    document.body.appendChild(card);

    const generateButton = card.querySelector('[data-action="generate"]');
    const output = card.querySelector("output");
    const errorArea = card.querySelector('[role="alert"]');

    generateButton.click();
    await flushAsyncWork();

    assert.equal(errorArea.hidden, false);
    assert.equal(errorArea.textContent, "boom");
    assert.equal(output.textContent, GENERATE_PLACEHOLDER);
    assert.equal(unhandledRejections.length, 0);
  } finally {
    process.off("unhandledRejection", onUnhandledRejection);
    restoreDom();
  }
});

test("card generate success enables copy and emits success toast", async () => {
  const restoreDom = installDom();
  const copiedValues = [];
  const toastMessages = [];

  try {
    const card = createGeneratorCard(
      createTestConfig(async () => ({ value: "abc123", entropy: 42 })),
      async (value) => {
        copiedValues.push(value);
        return true;
      },
      (message) => {
        toastMessages.push(message);
      },
    );

    document.body.appendChild(card);

    const generateButton = card.querySelector('[data-action="generate"]');
    const copyButton = card.querySelector('[data-action="copy"]');
    const output = card.querySelector("output");

    generateButton.click();
    await flushAsyncWork();

    assert.equal(output.textContent, "abc123");
    assert.equal(copyButton.disabled, false);

    copyButton.click();
    await flushAsyncWork();

    assert.deepEqual(copiedValues, ["abc123"]);
    assert.deepEqual(toastMessages, ["Test Card copied to clipboard."]);
  } finally {
    restoreDom();
  }
});

test("batch mode renders N lines and copy uses newline-joined payload", async () => {
  const restoreDom = installDom();
  const copiedValues = [];

  try {
    let callCount = 0;
    const card = createGeneratorCard(
      {
        ...createTestConfig(async () => ({ value: `value-${++callCount}`, entropy: 42 })),
        batchable: true,
        defaults: { batchCount: 1 },
        exportKeyName: "test-card",
      },
      async (value) => {
        copiedValues.push(value);
        return true;
      },
      () => {},
    );

    document.body.appendChild(card);

    const batchSelect = card.querySelector('select[aria-label="Test Card batch count"]');
    batchSelect.value = "5";
    batchSelect.dispatchEvent(new Event("change", { bubbles: true }));

    card.querySelector('[data-action="generate"]').click();
    await flushAsyncWork();

    const output = card.querySelector("output");
    assert.equal(output.textContent, "value-1\nvalue-2\nvalue-3\nvalue-4\nvalue-5");

    card.querySelector('[data-action="copy"]').click();
    await flushAsyncWork();

    assert.deepEqual(copiedValues, ["value-1\nvalue-2\nvalue-3\nvalue-4\nvalue-5"]);
  } finally {
    restoreDom();
  }
});

test("card copy failure emits failure toast", async () => {
  const restoreDom = installDom();
  const toastMessages = [];

  try {
    const card = createGeneratorCard(
      createTestConfig(async () => ({ value: "abc123", entropy: 42 })),
      async () => false,
      (message) => {
        toastMessages.push(message);
      },
    );

    document.body.appendChild(card);

    const generateButton = card.querySelector('[data-action="generate"]');
    const copyButton = card.querySelector('[data-action="copy"]');

    generateButton.click();
    await flushAsyncWork();

    copyButton.click();
    await flushAsyncWork();

    assert.deepEqual(toastMessages, ["Copy failed for Test Card."]);
  } finally {
    restoreDom();
  }
});

test("card generate uses updated redesigned control values", async () => {
  const restoreDom = installDom();
  const generatorCalls = [];

  try {
    const card = createGeneratorCard(
      {
        id: "control-card",
        title: "Control Card",
        description: "Control wiring test",
        defaults: {
          length: 16,
          format: "hex",
          prefix: "",
          uppercase: true,
          lowercase: false,
        },
        controls: [
          { type: "range", label: "Length", param: "length", min: 16, max: 64, default: 16 },
          {
            type: "select",
            label: "Format",
            param: "format",
            default: "hex",
            options: [
              { label: "Hex", value: "hex" },
              { label: "Base64", value: "base64" },
            ],
          },
          { type: "text", label: "Prefix", param: "prefix", default: "" },
          {
            type: "checkbox-group",
            label: "Character groups",
            options: [
              { label: "Uppercase", param: "uppercase", default: true },
              { label: "Lowercase", param: "lowercase", default: false },
            ],
          },
        ],
        generator: (params) => {
          generatorCalls.push({ ...params });
          return { value: "ok" };
        },
        showEntropy: false,
      },
      async () => true,
      () => {},
    );

    document.body.appendChild(card);

    const lengthInput = card.querySelector('input[type="range"]');
    const formatSelect = card.querySelector("select");
    const prefixInput = card.querySelector('input[type="text"]');
    const [uppercaseInput, lowercaseInput] = card.querySelectorAll('input[type="checkbox"]');
    const generateButton = card.querySelector('[data-action="generate"]');
    const output = card.querySelector("output");

    lengthInput.value = "32";
    lengthInput.dispatchEvent(new Event("input", { bubbles: true }));

    formatSelect.querySelector('option[value="base64"]').selected = true;
    formatSelect.dispatchEvent(new Event("change", { bubbles: true }));

    prefixInput.value = "rk-";
    prefixInput.dispatchEvent(new Event("input", { bubbles: true }));

    uppercaseInput.checked = false;
    uppercaseInput.dispatchEvent(new Event("change", { bubbles: true }));

    lowercaseInput.checked = true;
    lowercaseInput.dispatchEvent(new Event("change", { bubbles: true }));

    generateButton.click();
    await flushAsyncWork();

    assert.deepEqual(generatorCalls, [
      {
        length: 32,
        format: "base64",
        prefix: "rk-",
        uppercase: false,
        lowercase: true,
      },
    ]);
    assert.equal(typeof generatorCalls[0].length, "number");
    assert.equal(output.textContent, "ok");
  } finally {
    restoreDom();
  }
});

test("structured keypair outputs render in separate labeled blocks", async () => {
  const restoreDom = installDom();

  try {
    const card = createGeneratorCard(
      createTestConfig(async () => ({
        value: "combined",
        outputs: [
          { label: "Public Key", value: "-----BEGIN PUBLIC KEY-----\nAAA\n-----END PUBLIC KEY-----" },
          { label: "Private Key", value: "-----BEGIN PRIVATE KEY-----\nBBB\n-----END PRIVATE KEY-----" },
        ],
      })),
      async () => true,
      () => {},
    );

    document.body.appendChild(card);
    card.querySelector('[data-action="generate"]').click();
    await flushAsyncWork();

    assert.ok(card.textContent.includes("Public Key"));
    assert.ok(card.textContent.includes("Private Key"));
    assert.equal(card.querySelector("output").hidden, true);
  } finally {
    restoreDom();
  }
});

// --- Export Dropdown Tests ---

test("export trigger button is disabled before generate", async () => {
  const restoreDom = installDom();
  try {
    const card = createGeneratorCard(
      { ...createTestConfig(), batchable: true, defaults: {}, exportKeyName: "test" },
      async () => true,
      () => {},
    );
    document.body.appendChild(card);

    const exportButton = card.querySelector('[data-action="export"]');
    assert.ok(exportButton, "Export trigger button exists");
    assert.equal(exportButton.disabled, true, "Disabled before generation");
  } finally {
    restoreDom();
  }
});

test("export trigger button enables after generate", async () => {
  const restoreDom = installDom();
  try {
    const card = createGeneratorCard(
      { ...createTestConfig(async () => ({ value: "x" })), batchable: true, defaults: {}, exportKeyName: "test" },
      async () => true,
      () => {},
    );
    document.body.appendChild(card);

    card.querySelector('[data-action="generate"]').click();
    await flushAsyncWork();

    const exportButton = card.querySelector('[data-action="export"]');
    assert.equal(exportButton.disabled, false, "Enabled after generation");
  } finally {
    restoreDom();
  }
});

test("clicking export trigger toggles aria-expanded and menu visibility", async () => {
  const restoreDom = installDom();
  try {
    const card = createGeneratorCard(
      { ...createTestConfig(), batchable: true, defaults: {}, exportKeyName: "test" },
      async () => true,
      () => {},
    );
    document.body.appendChild(card);

    card.querySelector('[data-action="generate"]').click();
    await flushAsyncWork();

    const exportButton = card.querySelector('[data-action="export"]');
    const exportMenu = exportButton.nextElementSibling;

    assert.equal(exportMenu.hidden, true, "Menu hidden initially");
    assert.equal(exportButton.getAttribute("aria-expanded"), "false");

    exportButton.click();
    assert.equal(exportMenu.hidden, false, "Menu visible after click");
    assert.equal(exportButton.getAttribute("aria-expanded"), "true");

    exportButton.click();
    assert.equal(exportMenu.hidden, true, "Menu hidden on second click");
    assert.equal(exportButton.getAttribute("aria-expanded"), "false");
  } finally {
    restoreDom();
  }
});

test("clicking export-txt closes menu and triggers download", async () => {
  const restoreDom = installDom();
  const toastMessages = [];
  const downloadedFiles = [];

  try {
    // Mock document.createElement for anchor (downloadBlob uses <a>)
    const origCreateElement = document.createElement.bind(document);
    let mockAnchorUsed = false;
    document.createElement = function(tag) {
      const el = origCreateElement(tag);
      if (tag === "a") {
        const origClick = el.click?.bind(el);
        el.click = () => { mockAnchorUsed = true; downloadedFiles.push(el.download); };
      }
      return el;
    };

    const card = createGeneratorCard(
      { ...createTestConfig(async () => ({ value: "test-val" })), batchable: true, defaults: {}, exportKeyName: "test" },
      async () => true,
      (msg) => toastMessages.push(msg),
    );
    document.body.appendChild(card);

    card.querySelector('[data-action="generate"]').click();
    await flushAsyncWork();

    // Open menu
    card.querySelector('[data-action="export"]').click();

    // Click export-txt
    card.querySelector('[data-action="export-txt"]').click();

    const exportButton = card.querySelector('[data-action="export"]');
    const exportMenu = exportButton.nextElementSibling;

    assert.equal(exportMenu.hidden, true, "Menu closed after export");
    assert.equal(exportButton.getAttribute("aria-expanded"), "false");
    assert.ok(toastMessages.some((m) => m.includes("TXT")), "Toast shown for TXT export");
  } finally {
    restoreDom();
  }
});

test("Escape key closes the export menu", async () => {
  const restoreDom = installDom();
  try {
    const card = createGeneratorCard(
      { ...createTestConfig(async () => ({ value: "x" })), batchable: true, defaults: {}, exportKeyName: "test" },
      async () => true,
      () => {},
    );
    document.body.appendChild(card);

    card.querySelector('[data-action="generate"]').click();
    await flushAsyncWork();

    const exportButton = card.querySelector('[data-action="export"]');
    const exportMenu = exportButton.nextElementSibling;

    // Open menu
    exportButton.click();
    assert.equal(exportMenu.hidden, false, "Menu open");

    // Fire Escape
    card.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    assert.equal(exportMenu.hidden, true, "Menu closed by Escape");
    assert.equal(exportButton.getAttribute("aria-expanded"), "false");
  } finally {
    restoreDom();
  }
});

// --- Fix 1: aria-haspopup="menu" ---

test("export trigger button has aria-haspopup set to 'menu' (not 'true')", async () => {
  const restoreDom = installDom();
  try {
    const card = createGeneratorCard(
      createTestConfig(),
      async () => true,
      () => {},
    );
    document.body.appendChild(card);

    const exportButton = card.querySelector('[data-action="export"]');
    assert.ok(exportButton, "Export button exists");
    assert.equal(exportButton.getAttribute("aria-haspopup"), "menu", "aria-haspopup is 'menu'");
  } finally {
    restoreDom();
  }
});

// --- Fix 2: focus management on menu open ---

test("opening export menu moves focus to first menuitem", async () => {
  const restoreDom = installDom();
  try {
    const card = createGeneratorCard(
      { ...createTestConfig(async () => ({ value: "x" })), batchable: true, defaults: {}, exportKeyName: "test" },
      async () => true,
      () => {},
    );
    document.body.appendChild(card);

    card.querySelector('[data-action="generate"]').click();
    await flushAsyncWork();

    const exportButton = card.querySelector('[data-action="export"]');
    const firstMenuItem = card.querySelector('[role="menuitem"]');

    // linkedom does not track document.activeElement, so spy on focus() instead.
    let focusedItem = null;
    firstMenuItem.focus = () => { focusedItem = firstMenuItem; };

    exportButton.click();

    assert.equal(exportButton.getAttribute("aria-expanded"), "true", "Menu is open");
    assert.equal(focusedItem, firstMenuItem, "Focus moved to first menuitem");
  } finally {
    restoreDom();
  }
});

// --- Fix 3: aria-controls id uniqueness across two cards of same type ---

test("two cards of the same type get unique aria-controls values for QR toggle", async () => {
  const restoreDom = installDom();
  try {
    const makeConfig = () => ({
      id: "test-qr-card",
      title: "Test QR Card",
      description: "Test description",
      defaults: {},
      controls: [],
      generator: async () => ({ value: "hello" }),
      showEntropy: false,
      qrValue: () => "hello",
    });

    const card1 = createGeneratorCard(makeConfig(), async () => true, () => {});
    const card2 = createGeneratorCard(makeConfig(), async () => true, () => {});
    document.body.appendChild(card1);
    document.body.appendChild(card2);

    const toggle1 = card1.querySelector('[data-action="toggle-qr"]');
    const toggle2 = card2.querySelector('[data-action="toggle-qr"]');

    const controls1 = toggle1.getAttribute("aria-controls");
    const controls2 = toggle2.getAttribute("aria-controls");

    assert.ok(controls1, "Card 1 toggle has aria-controls");
    assert.ok(controls2, "Card 2 toggle has aria-controls");
    assert.notEqual(controls1, controls2, "aria-controls values are unique across cards");

    // Containers actually exist and are distinct elements
    const container1 = card1.querySelector(`#${controls1}`);
    const container2 = card2.querySelector(`#${controls2}`);
    assert.ok(container1, "Card 1 QR container found by aria-controls id");
    assert.ok(container2, "Card 2 QR container found by aria-controls id");
    assert.notEqual(container1, container2, "Containers are different elements");
  } finally {
    restoreDom();
  }
});
