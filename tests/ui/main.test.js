import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import { parseHTML } from "linkedom";

import {
  applyInsecureContextState,
  boot,
  createToastController,
  GENERATE_PLACEHOLDER,
  wireRefreshAll,
  wireSidebarFilters,
} from "../../src/main.js";

function installDom(html = "<!doctype html><html><body></body></html>") {
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
    HTMLSelectElement: globalThis.HTMLSelectElement,
    Event: globalThis.Event,
    Node: globalThis.Node,
    navigator: globalThis.navigator,
  };

  const { window } = parseHTML(html);

  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.HTMLSelectElement = window.HTMLSelectElement;
  globalThis.Event = window.Event;
  globalThis.Node = window.Node;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    writable: true,
    value: window.navigator,
  });

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

async function waitFor(assertion, { timeout = 1000, interval = 10 } = {}) {
  const deadline = Date.now() + timeout;

  while (true) {
    try {
      return assertion();
    } catch (error) {
      if (Date.now() >= deadline) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
}

function installCrypto(crypto = webcrypto) {
  const previous = globalThis.crypto;
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    writable: true,
    value: crypto,
  });
  return () => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      writable: true,
      value: previous,
    });
  };
}

function createFakeCard(id) {
  const card = document.createElement("section");
  card.id = id;

  const output = document.createElement("output");
  output.textContent = "existing value";

  const generateButton = document.createElement("button");
  generateButton.type = "button";
  generateButton.dataset.action = "generate";
  generateButton.textContent = "Generate";

  card.append(output, generateButton);
  return { card, output, generateButton };
}

test("insecure context contract renders banner and disables generation", () => {
  const restoreDom = installDom(`<!doctype html><html><body><div id="secure-context-banner" hidden></div></body></html>`);

  try {
    const bannerHost = document.getElementById("secure-context-banner");
    const first = createFakeCard("card-a");
    const second = createFakeCard("card-b");

    applyInsecureContextState({
      bannerHost,
      cards: [first.card, second.card],
    });

    assert.equal(bannerHost.hidden, false);
    assert.equal(bannerHost.getAttribute("role"), "alert");
    assert.match(bannerHost.textContent, /HTTPS|localhost/);
    assert.equal(first.generateButton.disabled, true);
    assert.equal(second.generateButton.disabled, true);
    assert.equal(first.output.textContent, GENERATE_PLACEHOLDER);
    assert.equal(second.output.textContent, GENERATE_PLACEHOLDER);
  } finally {
    restoreDom();
  }
});

test("refresh-all success contract disables button during work and shows success toast", async () => {
  const restoreDom = installDom(`<!doctype html><html><body><button id="refresh-all">Refresh All</button><div id="toast" class="opacity-0 translate-y-6"></div></body></html>`);

  try {
    const refreshAllButton = document.getElementById("refresh-all");
    const toast = document.getElementById("toast");
    const showToast = createToastController(toast);

    let generateCalls = 0;
    const cards = [
      {
        generateValue: async () => {
          generateCalls += 1;
          await new Promise((resolve) => setTimeout(resolve, 0));
        },
      },
      {
        generateValue: async () => {
          generateCalls += 1;
          await new Promise((resolve) => setTimeout(resolve, 0));
        },
      },
    ];

    wireRefreshAll({ refreshAllButton, cards, secure: true, showToast });

    refreshAllButton.click();
    assert.equal(refreshAllButton.disabled, true);

    await flushAsyncWork();

    assert.equal(generateCalls, 2);
    assert.equal(refreshAllButton.disabled, false);
    assert.equal(toast.textContent, "All generators refreshed.");
  } finally {
    restoreDom();
  }
});

test("refresh-all partial failure contract reports partial success without leaking errors", async () => {
  const restoreDom = installDom(`<!doctype html><html><body><button id="refresh-all">Refresh All</button></body></html>`);
  const toastMessages = [];
  const unhandledRejections = [];
  const onUnhandledRejection = (reason) => {
    unhandledRejections.push(reason);
  };

  process.on("unhandledRejection", onUnhandledRejection);

  try {
    const refreshAllButton = document.getElementById("refresh-all");
    const cards = [
      { generateValue: async () => "ok" },
      { generateValue: async () => Promise.reject(new Error("boom")) },
    ];

    wireRefreshAll({
      refreshAllButton,
      cards,
      secure: true,
      showToast: (message) => {
        toastMessages.push(message);
      },
    });

    refreshAllButton.click();
    await flushAsyncWork();

    assert.deepEqual(toastMessages, ["Refreshed 1/2 generators."]);
    assert.equal(unhandledRejections.length, 0);
    assert.equal(refreshAllButton.disabled, false);
  } finally {
    process.off("unhandledRejection", onUnhandledRejection);
    restoreDom();
  }
});

test("refresh-all insecure contract short-circuits and skips generation", async () => {
  const restoreDom = installDom(`<!doctype html><html><body><button id="refresh-all">Refresh All</button></body></html>`);

  try {
    const refreshAllButton = document.getElementById("refresh-all");
    const toastMessages = [];
    let generateCalls = 0;
    const cards = [
      {
        generateValue: async () => {
          generateCalls += 1;
        },
      },
    ];

    wireRefreshAll({
      refreshAllButton,
      cards,
      secure: false,
      showToast: (message) => {
        toastMessages.push(message);
      },
    });

    refreshAllButton.click();
    await flushAsyncWork();

    assert.equal(generateCalls, 0);
    assert.deepEqual(toastMessages, ["Refresh unavailable without HTTPS or localhost."]);
  } finally {
    restoreDom();
  }
});

test("boot renders nine cards and wires refresh-all against the real DOM shell", async () => {
  const restoreDom = installDom(`<!doctype html><html><body>
    <main id="app"></main>
    <button id="refresh-all" type="button">Refresh All</button>
    <div id="toast" class="opacity-0 translate-y-6"></div>
    <div id="secure-context-banner" hidden></div>
  </body></html>`);
  const restoreCrypto = installCrypto();

  try {
    const app = document.getElementById("app");
    const refreshAllButton = document.getElementById("refresh-all");
    const toast = document.getElementById("toast");

    boot();

    const cards = app.querySelectorAll("section");
    assert.equal(cards.length, 9);
    assert.equal(document.getElementById("secure-context-banner").hidden, true);

    refreshAllButton.click();
    assert.equal(refreshAllButton.disabled, true);

    await waitFor(() => {
      assert.equal(refreshAllButton.disabled, false);
      assert.match(toast.textContent, /refreshed/i);
    });

    const outputs = [...app.querySelectorAll("output")];
    assert.equal(outputs.length, 9);
    assert.ok(outputs.some((output) => output.textContent !== GENERATE_PLACEHOLDER));
  } finally {
    restoreCrypto();
    restoreDom();
  }
});

test("sidebar filter shows only matching cards and toggles the active button", () => {
  const restoreDom = installDom(`<!doctype html><html><body>
    <aside id="sidebar">
      <button type="button" data-filter="all" class="bg-primary-container text-on-primary-container font-bold">All</button>
      <button type="button" data-filter="keys" class="text-secondary hover:bg-surface-container-high">Keys</button>
    </aside>
  </body></html>`);

  try {
    const sidebar = document.getElementById("sidebar");
    const makeCard = (category) => {
      const card = document.createElement("section");
      card.dataset.category = category;
      return card;
    };
    const cards = [makeCard("keys"), makeCard("tokens"), makeCard("passcodes")];

    wireSidebarFilters({ container: sidebar, cards });

    const [allButton, keysButton] = [...sidebar.querySelectorAll("[data-filter]")];

    keysButton.click();
    assert.equal(cards[0].style.display, "");
    assert.equal(cards[1].style.display, "none");
    assert.equal(cards[2].style.display, "none");
    assert.equal(cards[0].hidden, false);
    assert.equal(cards[1].hidden, true);
    assert.equal(cards[2].hidden, true);
    assert.equal(keysButton.classList.contains("bg-primary-container"), true);
    assert.equal(keysButton.classList.contains("font-bold"), true);
    assert.equal(allButton.classList.contains("bg-primary-container"), false);
    assert.equal(allButton.classList.contains("text-secondary"), true);

    allButton.click();
    assert.equal(cards[0].style.display, "");
    assert.equal(cards[1].style.display, "");
    assert.equal(cards[2].style.display, "");
    assert.equal(cards[0].hidden, false);
    assert.equal(cards[1].hidden, false);
    assert.equal(cards[2].hidden, false);
    assert.equal(allButton.classList.contains("bg-primary-container"), true);
    assert.equal(keysButton.classList.contains("text-secondary"), true);
  } finally {
    restoreDom();
  }
});
