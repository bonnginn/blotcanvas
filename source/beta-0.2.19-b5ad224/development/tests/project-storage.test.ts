import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseLinkedFile,
  createLinkedProjectSnapshot,
  projectNameFromFiles,
  safeProjectFileStem,
} from "../app/project-storage.ts";

test("lightweight snapshots remove embedded pixels and generated previews", () => {
  const embeddedPixels = "x".repeat(100_000);
  const project = {
    version: 2,
    captures: [
      {
        clPreview: embeddedPixels,
        cl: {
          name: "0001_CL.tif",
          relativePath: "Experiment/GFP/0001_CL.tif",
          data: embeddedPixels,
          tiffData: embeddedPixels,
          width: 1200,
          height: 800,
        },
        regions: [
          {
            adjustment: {
              brightness: 100,
              levels: { low: 10, high: 220, gamma: 1 },
              preview: embeddedPixels,
            },
          },
        ],
      },
    ],
  };
  const snapshot = createLinkedProjectSnapshot(project);
  assert.equal(snapshot.captures[0].cl.data, undefined);
  assert.equal(snapshot.captures[0].cl.tiffData, undefined);
  assert.equal(snapshot.captures[0].clPreview, undefined);
  assert.equal(snapshot.captures[0].regions[0].adjustment.preview, undefined);
  assert.equal(snapshot.captures[0].cl.relativePath, "Experiment/GFP/0001_CL.tif");
  assert.equal(snapshot.captures[0].regions[0].adjustment.brightness, 100);
  assert.equal(snapshot.projectStorage.format, "linked-images");
  assert.ok(
    JSON.stringify(snapshot).length / JSON.stringify(project).length < 0.01,
    "the linked JSON should be less than 1% of an image-embedded project in this fixture",
  );
  assert.ok(project.captures[0].cl.data, "the live project must not be mutated");
});

test("lightweight snapshots preserve raw Min/Max and review metadata", () => {
  const project = {
    version: 3,
    confirmations: { exportReviewed: true },
    captures: [
      {
        cl: { name: "signal.tif", data: "pixels", tiffData: "raw" },
        regions: [
          {
            adjustment: {
              mode: "minmax",
              min: 1240,
              max: 18340,
              bitDepth: 16,
              invert: true,
              preview: "generated",
            },
            sourceCorners: [
              { x: 1, y: 2 },
              { x: 3, y: 2 },
              { x: 3, y: 4 },
              { x: 1, y: 4 },
            ],
          },
        ],
      },
    ],
  };
  const snapshot = createLinkedProjectSnapshot(project);
  assert.equal(snapshot.captures[0].regions[0].adjustment.preview, undefined);
  assert.equal(snapshot.captures[0].regions[0].adjustment.min, 1240);
  assert.equal(snapshot.captures[0].regions[0].adjustment.max, 18340);
  assert.equal(snapshot.captures[0].regions[0].adjustment.bitDepth, 16);
  assert.equal(snapshot.captures[0].regions[0].sourceCorners.length, 4);
  assert.equal(snapshot.confirmations.exportReviewed, true);
});

test("relative paths survive a renamed selected root folder", () => {
  const files = [
    {
      name: "0001_CL.tif",
      webkitRelativePath: "RenamedRoot/GFP/0001_CL.tif",
      size: 1234,
    },
  ];
  const match = chooseLinkedFile(
    {
      name: "0001_CL.tif",
      relativePath: "OriginalRoot/GFP/0001_CL.tif",
      fileSize: 1234,
    },
    "GFP",
    files,
  );
  assert.equal(match, files[0]);
});

test("ambiguous duplicate file names are not silently linked", () => {
  const files = [
    { name: "signal.tif", webkitRelativePath: "Root/A/signal.tif", size: 10 },
    { name: "signal.tif", webkitRelativePath: "Root/B/signal.tif", size: 10 },
  ];
  assert.equal(
    chooseLinkedFile({ name: "signal.tif" }, undefined, files),
    undefined,
  );
});

test("the selected folder becomes the default project name", () => {
  assert.equal(
    projectNameFromFiles([
      {
        name: "0001_CL.tif",
        webkitRelativePath: "260711/GFP/0001_CL.tif",
      },
    ]),
    "260711",
  );
});

test("individual files fall back to the working date", () => {
  assert.equal(
    projectNameFromFiles(
      [{ name: "0001_CL.tif" }],
      new Date(2026, 7, 17),
    ),
    "WB-20260817",
  );
});

test("Japanese project names remain readable in saved file names", () => {
  assert.equal(
    safeProjectFileStem(" 2026年8月17日 薬剤実験 / WB "),
    "2026年8月17日-薬剤実験-WB",
  );
});
