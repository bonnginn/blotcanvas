import assert from "node:assert/strict";
import test from "node:test";
import {
  autoLabelLayout,
  conditionRowsStart,
} from "../app/label-layout.ts";

test("unbroken scientific identifiers rotate instead of splitting", () => {
  for (const value of ["MLN", "AIII", "EGFP", "azobenzene"]) {
    const layout = autoLabelLayout(value, 20, 20);
    assert.equal(layout.mode, "rotate", value);
    assert.deepEqual(layout.lines, [value]);
  }
});

test("labels wrap only at a meaningful separator", () => {
  const layout = autoLabelLayout("drug treatment", 105, 20);
  assert.equal(layout.mode, "wrap");
  assert.deepEqual(layout.lines, ["drug", "treatment"]);
});

test("short labels remain on one line", () => {
  const layout = autoLabelLayout("WT", 34, 20);
  assert.equal(layout.mode, "single");
  assert.deepEqual(layout.lines, ["WT"]);
});

test("rotation remains available as a last resort", () => {
  const layout = autoLabelLayout("exceptionallylongunbreakablecondition", 8, 20);
  assert.equal(layout.mode, "rotate");
});

test("condition rows with different counts share the same image baseline", () => {
  const imageTop = 180;
  assert.equal(conditionRowsStart(imageTop, [40, 40, 40]), 60);
  assert.equal(conditionRowsStart(imageTop, [40, 40]), 100);
});
