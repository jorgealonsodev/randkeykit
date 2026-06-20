import assert from "node:assert/strict";
import test from "node:test";
import { parseHTML } from "linkedom";

import { createGeneratorCard } from "../../src/ui/card.js";

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

function createTestConfig(generator, extra = {}) {
  return {
    id: "test-qr-card",
    title: "Test QR Card",
    description: "Test description",
    defaults: {},
    controls: [],
    generator,
    showEntropy: false,
    ...extra,
  };
}

// A string guaranteed to exceed 271 bytes (QR v1-10 level L limit)
const LONG_PAYLOAD = "x".repeat(272);

// --- Test 1: short qrValue → toggle button visible, SVG present, aria-expanded false ---

test("QR: short qrValue after generate shows toggle button with aria-expanded=false and SVG in container", async () => {
  const restoreDom = installDom();
  try {
    const config = createTestConfig(
      async () => ({ value: "JBSWY3DPEB3W64TMMQ" }),
      {
        qrValue: () => "hello",
      },
    );

    const card = createGeneratorCard(config, async () => true, () => {});
    document.body.appendChild(card);

    card.querySelector('[data-action="generate"]').click();
    await flushAsyncWork();

    const toggleButton = card.querySelector('[data-action="toggle-qr"]');
    assert.ok(toggleButton, "Toggle QR button exists");
    assert.equal(toggleButton.hidden, false, "Toggle button is visible after generate");
    assert.equal(toggleButton.getAttribute("aria-expanded"), "false", "aria-expanded starts as false");

    const qrContainerId = toggleButton.getAttribute("aria-controls");
    const qrContainer = card.querySelector(`#${qrContainerId}`);
    assert.ok(qrContainer, "QR container exists");
    assert.ok(qrContainer.innerHTML.includes("<svg"), "QR container has SVG content");
    assert.equal(qrContainer.hidden, true, "QR container is hidden until toggled");
  } finally {
    restoreDom();
  }
});

// --- Test 2: clicking toggle shows QR container, changes aria-expanded and button text ---

test("QR: clicking toggle button shows container, sets aria-expanded=true, changes text to Hide QR", async () => {
  const restoreDom = installDom();
  try {
    const config = createTestConfig(
      async () => ({ value: "JBSWY3DPEB3W64TMMQ" }),
      { qrValue: () => "hello" },
    );

    const card = createGeneratorCard(config, async () => true, () => {});
    document.body.appendChild(card);

    card.querySelector('[data-action="generate"]').click();
    await flushAsyncWork();

    const toggleButton = card.querySelector('[data-action="toggle-qr"]');
    const qrContainer = card.querySelector(`#${toggleButton.getAttribute("aria-controls")}`);

    toggleButton.click();

    assert.equal(toggleButton.getAttribute("aria-expanded"), "true", "aria-expanded is true after first click");
    assert.equal(qrContainer.hidden, false, "QR container is visible after first click");
    assert.equal(toggleButton.textContent, "Hide QR", "Button text changes to Hide QR");
  } finally {
    restoreDom();
  }
});

// --- Test 3: clicking toggle twice hides container again ---

test("QR: clicking toggle twice hides container again and resets text to Show QR", async () => {
  const restoreDom = installDom();
  try {
    const config = createTestConfig(
      async () => ({ value: "JBSWY3DPEB3W64TMMQ" }),
      { qrValue: () => "hello" },
    );

    const card = createGeneratorCard(config, async () => true, () => {});
    document.body.appendChild(card);

    card.querySelector('[data-action="generate"]').click();
    await flushAsyncWork();

    const toggleButton = card.querySelector('[data-action="toggle-qr"]');
    const qrContainer = card.querySelector(`#${toggleButton.getAttribute("aria-controls")}`);

    toggleButton.click(); // show
    toggleButton.click(); // hide

    assert.equal(toggleButton.getAttribute("aria-expanded"), "false", "aria-expanded is false after second click");
    assert.equal(qrContainer.hidden, true, "QR container is hidden after second click");
    assert.equal(toggleButton.textContent, "Show QR", "Button text reverts to Show QR");
  } finally {
    restoreDom();
  }
});

// --- Test 4: qrValue returning >271 bytes → toggle button stays hidden ---

test("QR: qrValue returning a string over 271 bytes keeps toggle button hidden", async () => {
  const restoreDom = installDom();
  try {
    const config = createTestConfig(
      async () => ({ value: "JBSWY3DPEB3W64TMMQ" }),
      { qrValue: () => LONG_PAYLOAD },
    );

    const card = createGeneratorCard(config, async () => true, () => {});
    document.body.appendChild(card);

    card.querySelector('[data-action="generate"]').click();
    await flushAsyncWork();

    const toggleButton = card.querySelector('[data-action="toggle-qr"]');
    assert.ok(toggleButton, "Toggle QR button exists in DOM");
    assert.equal(toggleButton.hidden, true, "Toggle button stays hidden when QR is not viable");
  } finally {
    restoreDom();
  }
});

// --- Test 5: no qrValue, batchCount === 1 → default single value becomes QR payload, toggle visible ---

test("QR: no qrValue config and batchCount=1 uses first generated value as QR payload", async () => {
  const restoreDom = installDom();
  try {
    const config = {
      ...createTestConfig(async () => ({ value: "hello" })),
      batchable: true,
      defaults: { batchCount: 1 },
      exportKeyName: "test-qr",
    };

    const card = createGeneratorCard(config, async () => true, () => {});
    document.body.appendChild(card);

    card.querySelector('[data-action="generate"]').click();
    await flushAsyncWork();

    const toggleButton = card.querySelector('[data-action="toggle-qr"]');
    assert.equal(toggleButton.hidden, false, "Toggle button visible when single value is a short QR payload");
  } finally {
    restoreDom();
  }
});

// --- Test 6: no qrValue, batchCount > 1 → toggle button hidden ---

test("QR: no qrValue config and batchCount > 1 keeps toggle button hidden", async () => {
  const restoreDom = installDom();
  try {
    let callCount = 0;
    const config = {
      ...createTestConfig(async () => ({ value: `val-${++callCount}` })),
      batchable: true,
      defaults: { batchCount: 1 },
      exportKeyName: "test-qr",
    };

    const card = createGeneratorCard(config, async () => true, () => {});
    document.body.appendChild(card);

    const batchSelect = card.querySelector('select[aria-label="Test QR Card batch count"]');
    batchSelect.value = "5";
    batchSelect.dispatchEvent(new Event("change", { bubbles: true }));

    card.querySelector('[data-action="generate"]').click();
    await flushAsyncWork();

    const toggleButton = card.querySelector('[data-action="toggle-qr"]');
    assert.equal(toggleButton.hidden, true, "Toggle button hidden when batchCount > 1 and no qrValue");
  } finally {
    restoreDom();
  }
});

// --- Test 7: qrValue config + batchCount > 1 → toggle button hidden (Fix 5 guard) ---

test("QR: qrValue config with batchCount > 1 keeps toggle button hidden", async () => {
  const restoreDom = installDom();
  try {
    let callCount = 0;
    const config = {
      ...createTestConfig(async () => ({ value: `val-${++callCount}` })),
      batchable: true,
      defaults: { batchCount: 1 },
      exportKeyName: "test-qr",
      // TOTP-like: qrValue always produces a URI regardless of batch count
      qrValue: (result) => `otpauth://totp/test?secret=${result.values[0]}`,
    };

    const card = createGeneratorCard(config, async () => true, () => {});
    document.body.appendChild(card);

    const batchSelect = card.querySelector('select[aria-label="Test QR Card batch count"]');
    batchSelect.value = "3";
    batchSelect.dispatchEvent(new Event("change", { bubbles: true }));

    card.querySelector('[data-action="generate"]').click();
    await flushAsyncWork();

    const toggleButton = card.querySelector('[data-action="toggle-qr"]');
    assert.equal(toggleButton.hidden, true, "QR toggle hidden when qrValue config and batchCount > 1");
  } finally {
    restoreDom();
  }
});
