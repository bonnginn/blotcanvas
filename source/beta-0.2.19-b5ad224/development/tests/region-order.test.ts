import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalRegionOrder,
  reorderRegionWithinGel,
} from "../app/region-order.ts";

const regions = [
  { id: "g1-a", gelId: "g1" },
  { id: "g2-a", gelId: "g2" },
  { id: "g1-b", gelId: "g1" },
  { id: "g2-b", gelId: "g2" },
  { id: "g1-c", gelId: "g1" },
  { id: "g2-c", gelId: "g2" },
];

test("canonical order keeps known ids once and appends missing regions", () => {
  assert.deepEqual(canonicalRegionOrder(["g1-b", "missing", "g1-b"], regions), [
    "g1-b",
    "g1-a",
    "g2-a",
    "g2-b",
    "g1-c",
    "g2-c",
  ]);
});

test("drag reorder moves directly within one gel", () => {
  assert.deepEqual(
    reorderRegionWithinGel(
      regions.map((region) => region.id),
      regions,
      "g1-a",
      "g1-c",
      false,
      ["g1", "g2"],
    ),
    ["g1-b", "g2-a", "g1-c", "g2-b", "g1-a", "g2-c"],
  );
});

test("synchronized reorder applies the same position change to other gels", () => {
  assert.deepEqual(
    reorderRegionWithinGel(
      regions.map((region) => region.id),
      regions,
      "g1-a",
      "g1-c",
      true,
      ["g1", "g2"],
    ),
    ["g1-b", "g2-b", "g1-c", "g2-c", "g1-a", "g2-a"],
  );
});
