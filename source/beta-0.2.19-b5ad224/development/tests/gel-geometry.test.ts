import assert from "node:assert/strict";
import test from "node:test";
import {
  correctedPointToSource,
  correctedRectSourceCorners,
  sourcePointToCorrected,
} from "../app/gel-geometry.ts";

test("corrected/source transforms round-trip on a non-square image", () => {
  const source = { x: 12.5, y: 83.25 },
    corrected = sourcePointToCorrected(source, 2.75, 1600, 900),
    restored = correctedPointToSource(corrected, 2.75, 1600, 900);
  assert.ok(Math.abs(restored.x - source.x) < 1e-9);
  assert.ok(Math.abs(restored.y - source.y) < 1e-9);
});

test("a corrected crop stores four source-image corners", () => {
  const corners = correctedRectSourceCorners(
    { x: 10, y: 20, width: 60, height: 15 },
    1.2,
    1200,
    800,
  );
  assert.equal(corners.length, 4);
  assert.notEqual(corners[0].y, 20);
});
