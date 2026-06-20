import assert from "node:assert/strict";
import test from "node:test";
import { parseHTML } from "linkedom";

import { createGeneratorCard } from "../../src/ui/card.js";

function installDom() {
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
    Event: globalThis.Event,
    Node: globalThis.Node,
    navigator: globalThis.navigator,
  };

  const { window } = parseHTML("<!doctype html><html><body></body></html>");

  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event;
  globalThis.Node = window.Node;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    writable: true,
    value: window.navigator,
  });

  return () => {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.HTMLElement = previous.HTMLElement;
    globalThis.Event = previous.Event;
    globalThis.Node = previous.Node;
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      writable: true,
      value: previous.navigator,
    });
  };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createTestConfig(overrides = {}) {
  return {
    id: "test-card",
    title: "Test Card",
    description: "Test description",
    defaults: {},
    controls: [],
    generator: async () => ({ value: "test-value-12345", entropy: 80 }),
    showEntropy: false,
    ...overrides,
  };
}

// --- Show/Hide Toggle Tests ---

test("show/hide toggle button is hidden until value is generated", async () => {
  const restoreDom = installDom();
  try {
    const card = createGeneratorCard(
      createTestConfig(),
      async () => true,
      () => {},
    );
    document.body.appendChild(card);

    const toggleButton = card.querySelector('[data-action="toggle-visibility"]');
    assert.ok(toggleButton, "Toggle button exists");
    assert.equal(toggleButton.hidden, true, "Hidden before generation");
  } finally {
    restoreDom();
  }
});

test("show/hide toggle appears after generation and hides value on click", async () => {
  const restoreDom = installDom();
  try {
    const card = createGeneratorCard(
      createTestConfig(),
      async () => true,
      () => {},
    );
    document.body.appendChild(card);

    const generateButton = card.querySelector('[data-action="generate"]');
    const output = card.querySelector("output");
    const toggleButton = card.querySelector('[data-action="toggle-visibility"]');

    generateButton.click();
    await flushAsyncWork();

    assert.equal(toggleButton.hidden, false, "Toggle visible after generation");
    assert.equal(output.textContent, "test-value-12345");
    assert.equal(toggleButton.getAttribute("aria-label"), "Hide value");

    // Click to hide
    toggleButton.click();
    assert.equal(output.textContent, "•".repeat("test-value-12345".length));
    assert.equal(toggleButton.getAttribute("aria-label"), "Show value");

    // Click to show
    toggleButton.click();
    assert.equal(output.textContent, "test-value-12345");
    assert.equal(toggleButton.getAttribute("aria-label"), "Hide value");
  } finally {
    restoreDom();
  }
});

test("copy always uses real value even when masked", async () => {
  const restoreDom = installDom();
  const copiedValues = [];

  try {
    const card = createGeneratorCard(
      createTestConfig(),
      async (value) => { copiedValues.push(value); return true; },
      () => {},
    );
    document.body.appendChild(card);

    const generateButton = card.querySelector('[data-action="generate"]');
    const copyButton = card.querySelector('[data-action="copy"]');
    const toggleButton = card.querySelector('[data-action="toggle-visibility"]');

    generateButton.click();
    await flushAsyncWork();

    // Mask the value
    toggleButton.click();

    // Copy while masked
    copyButton.click();
    await flushAsyncWork();

    assert.deepEqual(copiedValues, ["test-value-12345"], "Copies real value, not masked");
  } finally {
    restoreDom();
  }
});

// --- Crack-Time Badge Tests ---

test("entropy badge includes crack-time when showCrackTime is true", async () => {
  const restoreDom = installDom();
  try {
    const card = createGeneratorCard(
      createTestConfig({
        showEntropy: true,
        entropy: () => 80,
        showCrackTime: true,
      }),
      async () => true,
      () => {},
    );
    document.body.appendChild(card);

    const generateButton = card.querySelector('[data-action="generate"]');
    generateButton.click();
    await flushAsyncWork();

    // Find the entropy badge (it's a div in the header with the bits text)
    const badge = card.querySelector(".bg-tertiary-container\\/20");
    assert.ok(badge, "Badge exists");
    assert.match(badge.textContent, /~80 bits/, "Shows entropy");
    assert.match(badge.textContent, /·/, "Has separator");
  } finally {
    restoreDom();
  }
});

test("entropy badge omits crack-time when showCrackTime is false", async () => {
  const restoreDom = installDom();
  try {
    const card = createGeneratorCard(
      createTestConfig({
        showEntropy: true,
        entropy: () => 80,
        showCrackTime: false,
      }),
      async () => true,
      () => {},
    );
    document.body.appendChild(card);

    const generateButton = card.querySelector('[data-action="generate"]');
    generateButton.click();
    await flushAsyncWork();

    const badge = card.querySelector(".bg-tertiary-container\\/20");
    assert.ok(badge, "Badge exists");
    assert.equal(badge.textContent, "~80 bits", "Only entropy, no crack-time");
  } finally {
    restoreDom();
  }
});

// --- History Callback Tests ---

test("onCopy callback fires with entry on successful copy", async () => {
  const restoreDom = installDom();
  const historyEntries = [];

  try {
    const card = createGeneratorCard(
      createTestConfig({
        onCopy: (entry) => historyEntries.push(entry),
      }),
      async () => true,
      () => {},
    );
    document.body.appendChild(card);

    const generateButton = card.querySelector('[data-action="generate"]');
    const copyButton = card.querySelector('[data-action="copy"]');

    generateButton.click();
    await flushAsyncWork();

    copyButton.click();
    await flushAsyncWork();

    assert.equal(historyEntries.length, 1);
    assert.equal(historyEntries[0].value, "test-value-12345");
    assert.equal(historyEntries[0].source, "Test Card");
    assert.equal(historyEntries[0].count, 1);
    assert.ok(historyEntries[0].timestamp instanceof Date);
  } finally {
    restoreDom();
  }
});

// --- Auto-Clear Timer Tests ---

test("auto-clear timer is scheduled when autoClearMs returns positive value", async () => {
  const restoreDom = installDom();
  let clearCalled = false;

  // Mock navigator.clipboard.writeText for clear
  const origClipboard = globalThis.navigator.clipboard;
  Object.defineProperty(globalThis.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text) => {
        if (text === "") clearCalled = true;
        return true;
      },
    },
  });

  try {
    const card = createGeneratorCard(
      createTestConfig({
        autoClearMs: () => 50, // 50ms for fast test
      }),
      async () => true,
      () => {},
    );
    document.body.appendChild(card);

    const generateButton = card.querySelector('[data-action="generate"]');
    const copyButton = card.querySelector('[data-action="copy"]');

    generateButton.click();
    await flushAsyncWork();

    copyButton.click();
    await flushAsyncWork();

    // Wait for auto-clear timer
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.equal(clearCalled, true, "Clipboard was cleared after timeout");
  } finally {
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: origClipboard,
    });
    restoreDom();
  }
});

test("auto-clear is not scheduled when autoClearMs returns 0", async () => {
  const restoreDom = installDom();
  let clearCalled = false;

  const origClipboard = globalThis.navigator.clipboard;
  Object.defineProperty(globalThis.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text) => {
        if (text === "") clearCalled = true;
        return true;
      },
    },
  });

  try {
    const card = createGeneratorCard(
      createTestConfig({
        autoClearMs: () => 0, // disabled
      }),
      async () => true,
      () => {},
    );
    document.body.appendChild(card);

    const generateButton = card.querySelector('[data-action="generate"]');
    const copyButton = card.querySelector('[data-action="copy"]');

    generateButton.click();
    await flushAsyncWork();

    copyButton.click();
    await flushAsyncWork();

    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.equal(clearCalled, false, "Clipboard was NOT cleared (disabled)");
  } finally {
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: origClipboard,
    });
    restoreDom();
  }
});
