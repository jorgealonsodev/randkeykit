import assert from "node:assert/strict";
import test from "node:test";

import { formatCrackTime } from "../../src/crypto/crack-time.js";

test("formatCrackTime returns 'instant' for very low entropy", () => {
  assert.equal(formatCrackTime(0), "instant");
  assert.equal(formatCrackTime(10), "instant");
  assert.equal(formatCrackTime(20), "instant");
  assert.equal(formatCrackTime(30), "instant");
});

test("formatCrackTime returns seconds for low-medium entropy", () => {
  // 0.5 * 2^36 / 1e10 = 0.5 * 68719476736 / 1e10 ≈ 3.4 seconds
  const result = formatCrackTime(36);
  assert.match(result, /seconds/);
});

test("formatCrackTime returns minutes for medium entropy", () => {
  // 0.5 * 2^42 / 1e10 = 0.5 * 4398046511104 / 1e10 ≈ 220 seconds ≈ 3.7 minutes
  const result = formatCrackTime(42);
  assert.match(result, /minutes/);
});

test("formatCrackTime returns hours for medium-high entropy", () => {
  // 0.5 * 2^50 / 1e10 ≈ 56 seconds... let me recalculate
  // 0.5 * 2^55 / 1e10 = 0.5 * 36028797018963968 / 1e10 ≈ 1801440 seconds ≈ 500 hours
  const result = formatCrackTime(55);
  assert.match(result, /hours|days/);
});

test("formatCrackTime returns days for high entropy", () => {
  // 0.5 * 2^60 / 1e10 ≈ 57646075 seconds ≈ 667 days
  const result = formatCrackTime(60);
  assert.match(result, /days|years/);
});

test("formatCrackTime returns years for very high entropy", () => {
  // 0.5 * 2^70 / 1e10 ≈ 59029581035 seconds ≈ 1870 years
  const result = formatCrackTime(70);
  assert.match(result, /years|millennium/);
});

test("formatCrackTime returns 'millennium+' for extreme entropy", () => {
  assert.equal(formatCrackTime(128), "millennium+");
  assert.equal(formatCrackTime(256), "millennium+");
});

test("formatCrackTime handles invalid input", () => {
  assert.equal(formatCrackTime(-1), "unknown");
  assert.equal(formatCrackTime(NaN), "unknown");
  assert.equal(formatCrackTime(Infinity), "unknown");
});

test("formatCrackTime returns 'centuries' for appropriate range", () => {
  // 0.5 * 2^66 / 1e10 ≈ 3689348814 seconds ≈ 117 years → centuries
  const result = formatCrackTime(66);
  assert.match(result, /centuries/);
});
