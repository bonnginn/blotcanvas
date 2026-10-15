import assert from "node:assert/strict";
import test from "node:test";
import {
  adjustmentGroupKey,
  mapRawToDisplay,
  rawClipStatistics,
  rawPercentileRange,
} from "../app/display-adjustment.ts";

test("16-bit auto range remains in source pixel units", () => {
  const values = Uint16Array.from({ length: 1000 }, (_, index) => index * 60);
  const range = rawPercentileRange(values, 16, 0.01, 0.99);
  assert.ok(range.min > 255);
  assert.ok(range.max > range.min);
  assert.equal(range.bitDepth, 16);
});

test("raw min/max map linearly and inversion is display-only", () => {
  const range = { min: 1000, max: 5000, bitDepth: 16, invert: false };
  assert.equal(mapRawToDisplay(1000, range), 0);
  assert.equal(mapRawToDisplay(3000, range), 128);
  assert.equal(mapRawToDisplay(5000, { ...range, invert: true }), 0);
});

test("clip statistics distinguish source saturation from display clipping", () => {
  const stats = rawClipStatistics(
    Uint16Array.from([0, 100, 200, 65535]),
    { min: 100, max: 200, bitDepth: 16, invert: false },
  );
  assert.equal(stats.sourceSaturatedPercent, 25);
  assert.equal(stats.clippedLowPercent, 50);
  assert.equal(stats.clippedHighPercent, 50);
});

test("sharing key is exact after trimming and includes bit depth", () => {
  assert.equal(adjustmentGroupKey(" GFP ", 16), "GFP\u000016");
  assert.notEqual(adjustmentGroupKey("GFP", 8), adjustmentGroupKey("GFP", 16));
});
