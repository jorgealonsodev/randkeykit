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
    Node: globalThis.Node,
  };

  const { window } = parseHTML("<!doctype html><html><body></body></html>");

  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.HTMLSelectElement = window.HTMLSelectElement;
  globalThis.Event = window.Event;
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
