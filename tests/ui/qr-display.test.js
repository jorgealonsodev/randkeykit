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

test("QR slot renders SVG output and download button", async () => {
  const restoreDom = installDom();

  try {
    const card = createGeneratorCard(
      {
        id: "totp-card",
        title: "TOTP Secret",
        description: "QR output test",
        defaults: { issuer: "RandKeyKit", account: "alice" },
        controls: [],
        generator: () => ({ value: "secret", otpauthUri: "otpauth://totp/RandKeyKit:alice?secret=secret" }),
        qrSlot: () => ({
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
          downloadName: "totp-qr.svg",
        }),
        showEntropy: false,
      },
      async () => true,
      () => {},
    );

    document.body.appendChild(card);
    card.querySelector('[data-action="generate"]').click();
    await flushAsyncWork();

    const qrContainer = card.querySelector(".qr-svg-container");
    const downloadButton = [...card.querySelectorAll("button")].find((button) => button.textContent === "Download QR");

    assert.equal(qrContainer.hidden, false);
    assert.ok(qrContainer.querySelector("svg"));
    assert.equal(downloadButton.getAttribute("aria-label"), "Download QR code as SVG");
  } finally {
    restoreDom();
  }
});

test("QR slot hides SVG and shows helper note in batch mode", async () => {
  const restoreDom = installDom();

  try {
    let callCount = 0;
    const card = createGeneratorCard(
      {
        id: "totp-card",
        title: "TOTP Secret",
        description: "QR output test",
        defaults: { batchCount: 1 },
        controls: [],
        batchable: true,
        generator: () => ({ value: `secret-${++callCount}`, otpauthUri: "otpauth://totp/RandKeyKit:alice?secret=secret" }),
        qrSlot: (result) => ((result.values?.length ?? 1) > 1
          ? { note: "QR available only for a single secret at a time." }
          : {
              svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
              downloadName: "totp-qr.svg",
            }),
        showEntropy: false,
      },
      async () => true,
      () => {},
    );

    document.body.appendChild(card);
    const batchSelect = card.querySelector('select[aria-label="TOTP Secret batch count"]');
    batchSelect.value = "5";
    batchSelect.dispatchEvent(new Event("change", { bubbles: true }));

    card.querySelector('[data-action="generate"]').click();
    await flushAsyncWork();

    const qrContainer = card.querySelector(".qr-svg-container");
    const note = [...card.querySelectorAll("p")].find((element) => element.textContent.includes("QR available only for a single secret at a time."));

    assert.equal(qrContainer.hidden, true);
    assert.ok(note);
  } finally {
    restoreDom();
  }
});
