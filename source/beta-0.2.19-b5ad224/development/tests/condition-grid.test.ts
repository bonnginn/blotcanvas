import assert from "node:assert/strict";
import test from "node:test";
import {
  fillSeries,
  groupShowsSeparator,
  nextGridCell,
  parseClipboardGrid,
  pasteGrid,
  resizeLaneGrid,
  type GridGel,
} from "../app/condition-grid.ts";

const row = (values: string[]) => ({
  id: "r",
  name: "Condition",
  values,
  visible: true,
});

test("a new condition grid can remain at zero lanes", () => {
  const gel: GridGel = { lanes: 0, conditions: [] };
  resizeLaneGrid(gel, 0);
  assert.equal(gel.lanes, 0);
});

test("lane resize preserves available values and supports undo snapshots", () => {
  const original: GridGel = { lanes: 2, conditions: [row(["−", "+"])] },
    snapshot = structuredClone(original);
  resizeLaneGrid(original, 4);
  assert.deepEqual(original.conditions[0].values, ["−", "+", "", ""]);
  assert.deepEqual(snapshot.conditions[0].values, ["−", "+"]);
  resizeLaneGrid(original, 1);
  assert.deepEqual(original.conditions[0].values, ["−"]);
});

test("Excel paste preserves blank cells and adds rows/lanes", () => {
  const gel: GridGel = { lanes: 1, conditions: [row(["old"])] },
    clipboard = parseClipboardGrid("A\t\tC\n−\t+\t−");
  pasteGrid(gel, 0, 0, clipboard, (index, lanes) => ({
    ...row(Array(lanes).fill("")),
    id: `r${index}`,
  }));
  assert.equal(gel.lanes, 3);
  assert.deepEqual(gel.conditions[0].values, ["A", "", "C"]);
  assert.deepEqual(gel.conditions[1].values, ["−", "+", "−"]);
});

test("paste through a merged cell removes only the conflicting merge", () => {
  const gel: GridGel = {
    lanes: 5,
    conditions: [
      {
        ...row(["", "", "", "", ""]),
        groups: [
          { label: "A", start: 0, span: 2 },
          { label: "B", start: 3, span: 2 },
        ],
      },
    ],
  };
  pasteGrid(gel, 0, 0, [["x", "y"]], () => row([]));
  assert.deepEqual(gel.conditions[0].groups, [{ label: "B", start: 3, span: 2 }]);
});

test("autofill recognizes numeric sequences and repeating symbols", () => {
  assert.deepEqual(fillSeries(["3"], 4), ["3", "4", "5", "6"]);
  assert.deepEqual(fillSeries(["1", "3"], 5), ["1", "3", "5", "7", "9"]);
  assert.deepEqual(fillSeries(["−", "+"], 6), ["−", "+", "−", "+", "−", "+"]);
  assert.deepEqual(fillSeries(["#1"], 4), ["#1", "#2", "#3", "#4"]);
  assert.deepEqual(fillSeries(["Gene A #1"], 3), ["Gene A #1", "Gene A #2", "Gene A #3"]);
  assert.deepEqual(fillSeries(["Sample-01"], 3), ["Sample-01", "Sample-02", "Sample-03"]);
});

test("keyboard navigation skips the hidden lanes inside merged cells", () => {
  const gel: GridGel = {
    lanes: 6,
    conditions: [
      {
        ...row(["", "", "", "", "", ""]),
        groups: [
          { label: "A", start: 0, span: 2 },
          { label: "B", start: 2, span: 3 },
          { label: "C", start: 5, span: 1 },
        ],
      },
      row(["1", "2", "3", "4", "5", "6"]),
    ],
  };
  assert.deepEqual(
    nextGridCell(gel, { rowIndex: 0, start: 0, span: 2 }, "Tab"),
    { rowIndex: 0, start: 2, span: 3 },
  );
  assert.deepEqual(
    nextGridCell(gel, { rowIndex: 0, start: 2, span: 3 }, "ArrowRight"),
    { rowIndex: 0, start: 5, span: 1 },
  );
  assert.deepEqual(
    nextGridCell(gel, { rowIndex: 0, start: 0, span: 2 }, "Tab", true),
    { rowIndex: 0, start: 0, span: 2 },
  );
});

test("vertical navigation selects the merged cell covering the same lane", () => {
  const gel: GridGel = {
    lanes: 4,
    conditions: [
      row(["1", "2", "3", "4"]),
      {
        ...row(["", "", "", ""]),
        groups: [
          { label: "left", start: 0, span: 2 },
          { label: "right", start: 2, span: 2 },
        ],
      },
    ],
  };
  assert.deepEqual(
    nextGridCell(gel, { rowIndex: 0, start: 3, span: 1 }, "ArrowDown"),
    { rowIndex: 1, start: 2, span: 2 },
  );
  assert.deepEqual(
    nextGridCell(gel, { rowIndex: 1, start: 2, span: 2 }, "ArrowUp"),
    { rowIndex: 0, start: 2, span: 1 },
  );
});

test("separator lines are limited to labeled multi-lane groups", () => {
  const groupedRow = { ...row(["", "", ""]), lineBelow: true };
  assert.equal(
    groupShowsSeparator(groupedRow, { label: "EGFP", start: 0, span: 1 }),
    false,
  );
  assert.equal(
    groupShowsSeparator(groupedRow, { label: "myc-AurA", start: 1, span: 2 }),
    true,
  );
  assert.equal(
    groupShowsSeparator(groupedRow, {
      label: "myc-AurA",
      start: 1,
      span: 2,
      showLine: false,
    }),
    false,
  );
});
