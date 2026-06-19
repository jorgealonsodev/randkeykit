import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";

import { createEntropyMap } from "../../src/ui/entropy-map.js";

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

function createFakeCanvas() {
  const ctx = {
    fillStyle: "",
    fillRectCalls: 0,
    setTransformCalls: 0,
    fillRect() {
      this.fillRectCalls += 1;
    },
    setTransform() {
      this.setTransformCalls += 1;
    },
  };

  return {
    ctx,
    width: 0,
    height: 0,
    getContext() {
      return ctx;
    },
    getBoundingClientRect() {
      return { width: 480, height: 160 };
    },
  };
}

test("createEntropyMap returns a no-op when canvas is missing", () => {
  const map = createEntropyMap(null);
  assert.equal(typeof map.render, "function");
  // Should not throw.
  map.render();
});

test("createEntropyMap render samples real random bytes and paints cells", () => {
  const restoreCrypto = installCrypto();
  let getRandomValuesCalls = 0;
  const restoreSpy = installCrypto({
    getRandomValues(array) {
      getRandomValuesCalls += 1;
      return webcrypto.getRandomValues(array);
    },
  });

  try {
    const canvas = createFakeCanvas();
    const map = createEntropyMap(canvas);

    map.render();

    assert.equal(getRandomValuesCalls, 1);
    // 48 cols * 16 rows cells + 1 background fill.
    assert.equal(canvas.ctx.fillRectCalls, 48 * 16 + 1);
    assert.ok(canvas.width > 0);
    assert.ok(canvas.height > 0);
  } finally {
    restoreSpy();
    restoreCrypto();
  }
});

test("createEntropyMap render is a no-op without crypto.getRandomValues", () => {
  const restoreCrypto = installCrypto({});

  try {
    const canvas = createFakeCanvas();
    const map = createEntropyMap(canvas);
    map.render();
    assert.equal(canvas.ctx.fillRectCalls, 0);
  } finally {
    restoreCrypto();
  }
});
