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
  };

  const { window } = parseHTML("<!doctype html><html><body></body></html>");

  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event;
  globalThis.Node = window.Node;

  return () => {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.HTMLElement = previous.HTMLElement;
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
