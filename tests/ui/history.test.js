import assert from "node:assert/strict";
import test from "node:test";

import { createHistoryStore, formatPreview } from "../../src/ui/history.js";

// --- formatPreview tests ---

test("formatPreview masks short values (≤6 chars) with bullets", () => {
  assert.equal(formatPreview("abc"), "•••");
  assert.equal(formatPreview("abcdef"), "••••••");
  assert.equal(formatPreview("a"), "•");
});

test("formatPreview shows first 4 + ellipsis + last 2 for long values", () => {
  assert.equal(formatPreview("abcdefghijklmnop"), "abcd…op");
  assert.equal(formatPreview("secret-key-123"), "secr…23");
  assert.equal(formatPreview("1234567"), "1234…67");
});

test("formatPreview prefixes batch count for multi-value entries", () => {
  assert.equal(formatPreview("abcdefghijklmnop\nqrstuvwxyz", 10), "Batch(10): abcd…op");
});

test("formatPreview handles empty and null", () => {
  assert.equal(formatPreview(""), "");
  assert.equal(formatPreview(null), "");
  assert.equal(formatPreview(undefined), "");
});

// --- createHistoryStore tests ---

test("createHistoryStore starts empty", () => {
  const store = createHistoryStore();
  assert.equal(store.size, 0);
  assert.deepEqual(store.getAll(), []);
});

test("createHistoryStore push adds entries", () => {
  const store = createHistoryStore();
  const entry = { value: "abc123", timestamp: new Date(), source: "API Key", count: 1 };
  store.push(entry);
  assert.equal(store.size, 1);
  assert.deepEqual(store.getAll(), [entry]);
});

test("createHistoryStore getAll returns newest first", () => {
  const store = createHistoryStore();
  const first = { value: "first", timestamp: new Date(1000), source: "A" };
  const second = { value: "second", timestamp: new Date(2000), source: "B" };
  store.push(first);
  store.push(second);
  const all = store.getAll();
  assert.equal(all[0].value, "second");
  assert.equal(all[1].value, "first");
});

test("createHistoryStore evicts oldest at capacity (FIFO)", () => {
  const store = createHistoryStore(3);
  store.push({ value: "a", timestamp: new Date(), source: "X" });
  store.push({ value: "b", timestamp: new Date(), source: "X" });
  store.push({ value: "c", timestamp: new Date(), source: "X" });
  store.push({ value: "d", timestamp: new Date(), source: "X" });

  assert.equal(store.size, 3);
  const all = store.getAll();
  assert.equal(all[0].value, "d");
  assert.equal(all[1].value, "c");
  assert.equal(all[2].value, "b");
});

test("createHistoryStore clear removes all entries", () => {
  const store = createHistoryStore();
  store.push({ value: "x", timestamp: new Date(), source: "Y" });
  store.push({ value: "y", timestamp: new Date(), source: "Y" });
  store.clear();
  assert.equal(store.size, 0);
  assert.deepEqual(store.getAll(), []);
});

test("createHistoryStore default maxSize is 20", () => {
  const store = createHistoryStore();
  for (let i = 0; i < 25; i++) {
    store.push({ value: `v${i}`, timestamp: new Date(), source: "X" });
  }
  assert.equal(store.size, 20);
  const all = store.getAll();
  assert.equal(all[0].value, "v24");
  assert.equal(all[19].value, "v5");
});
