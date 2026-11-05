"use client";
import { downloadBlob } from "./download-blob";
import { figureDrawingMetrics, figureCropHeight, figureMarkerBottom } from "./figure-layout";

import {
  ChangeEvent,
  ClipboardEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isEnglishUi, useUiTranslation } from "./i18n";
import {
  chooseLinkedFile,
  createLinkedProjectSnapshot,
  isDefaultProjectName,
  projectNameFromFiles,
  safeProjectFileStem,
} from "./project-storage";
import {
  autoLabelLayout as generalAutoLabelLayout,
  conditionRowsStart,
  labelWidthEstimate,
  figureLabelWidthEstimate,
  type AutoLabelLayout,
} from "./label-layout";
import {
  correctedRectSourceCorners,
  sourcePointToCorrected,
  type NormalizedPoint,
} from "./gel-geometry";
import {
  adjustmentGroupKey,
  mapRawToDisplay,
  rawClipStatistics,
  rawPercentileRange,
  type RawDisplayRange,
} from "./display-adjustment";
import {
  fillRowToRight,
  groupShowsSeparator,
  nextGridCell,
  parseClipboardGrid,
  pasteGrid,
  resizeLaneGrid,
} from "./condition-grid";
import {
  canonicalRegionOrder,
  reorderRegionWithinGel,
} from "./region-order";

type Img = {
  name: string;
  data: string;
  width: number;
  height: number;
  relativePath?: string;
  tiffData?: string;
  bitsPerSample?: number;
  fileSize?: number;
  lastModified?: number;
  derivedFromRoles?: ("cl" | "m")[];
};
type Marker = {
  mw: number;
  on: boolean;
  y: number;
  detected?: boolean;
  placed?: boolean;
  sourceLine?: [NormalizedPoint, NormalizedPoint];
};
type Levels = { low: number; high: number; gamma: number };
type Adjustment = {
  mode?: "legacy" | "minmax";
  min?: number;
  max?: number;
  bitDepth?: number;
  linked?: boolean;
  autoApplied?: boolean;
  clippedLowPercent?: number;
  clippedHighPercent?: number;
  sourceSaturatedPercent?: number;
  levels?: Levels;
  preview?: string;
  brightness: number;
  contrast: number;
  invert: boolean;
};
type Region = {
  id: string;
  name: string;
  x: number;
  y: number;
  h: number;
  gelId: string;
  antibody: string;
  markers: Marker[];
  markerPresetId?: string;
  adjustment?: Adjustment;
  rotation?: number;
  sourceCorners?: NormalizedPoint[];
  needsReview?: boolean;
};
type Condition = {
  id: string;
  name: string;
  values: string[];
  visible: boolean;
  groupSize?: number;
  lineBelow?: boolean;
  groups?: { label: string; start: number; span: number; showLine?: boolean }[];
};
type Gel = {
  id: string;
  name: string;
  width: number;
  lanes: number;
  conditions: Condition[];
  laneCenter: number;
  laneSpan: number;
  markerState?: "configured" | "none" | "unconfirmed";
};
type ConditionHistoryState = {
  gels: Array<
    Pick<Gel, "id" | "lanes" | "conditions" | "laneCenter" | "laneSpan">
  >;
};
type MarkerPreset = {
  id: string;
  name: string;
  values: number[];
  builtIn?: boolean;
  lastUsedAt?: number;
};
type Capture = {
  id: string;
  key: string;
  folder?: string;
  antibodies: string[];
  assignedGelIds?: string[];
  cl?: Img;
  merge?: Img;
  m?: Img;
  rotation: number;
  gelRotations?: Record<string, number>;
  brightness: number;
  contrast: number;
  invert: boolean;
  levels?: Levels;
  clPreview?: string;
  regions: Region[];
};
type QuantRoi = {
  id: string;
  lane: number;
  x: number;
  y: number;
  w: number;
  h: number;
};
type QuantMeasurement = {
  lane: number;
  area: number;
  mean: number;
  background: number;
  correctedMean: number;
  correctedIntegrated: number;
  netMean?: number;
  notDetected?: boolean;
  saturatedPercent: number;
  bitDepth: number;
};
type QuantTarget = {
  regionId: string;
  enabled: boolean;
  signalMode: "light" | "dark";
  rois: QuantRoi[];
  backgroundRoi?: QuantRoi;
  measurements: QuantMeasurement[];
  measuredAt?: string;
};
type QuantLaneProfile = {
  regionId: string;
  lane: number;
  bitDepth: number;
  background: number;
  points: { position: number; sourceMean: number; netIntensity: number }[];
};
type Quantification = {
  targets: QuantTarget[];
  normalizationRegionId?: string;
  normalizationRegionIds: Record<string, string>;
  valueMode: "correctedIntegrated" | "correctedMean";
  nonDetectMode: "nd" | "zero";
  colors: Record<string, string>;
  graph: {
    type: "bar" | "dot";
    fontFamily: string;
    fontSize: number;
    width: number;
    height: number;
    showValues: boolean;
    title: string;
    palette: "nature" | "okabe-ito" | "gray" | "custom";
    customColors: string[];
  };
};
type Project = {
  version: 2 | 3;
  schemaVersion?: 3;
  appVersion?: string;
  name: string;
  captures: Capture[];
  cropX: number;
  cropW: number;
  gels: Gel[];
  lanes: number;
  conditions: Condition[];
  order: string[];
  fontFamily: string;
  fontSize: number;
  markerPresets: MarkerPreset[];
  pageSize: "A4" | "Letter";
  panelWidthMm: number;
  sourceRecordMode: "cl" | "merge" | "both";
  labelSide: "antibody-left" | "antibody-right";
  syncGelOrder: boolean;
  quantification?: Quantification;
  projectStorage?: {
    format: "linked-images";
    version: 1;
    savedAt: string;
  };
  confirmations?: {
    exportReviewed?: boolean;
    sourceRecordReviewed?: boolean;
  };
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const FEEDBACK_FORM_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_FEEDBACK_FORM_URL) ||
  "https://docs.google.com/forms/d/e/1FAIpQLSdeyxdS4GvfxPfxJ7Gea2XfNhHuiPkFYMYK7AFaV-jXBKGqSw/viewform";
const QUANTIFICATION_ENABLED = true;

declare global {
  interface Window {
    UTIF?: {
      decode: (b: ArrayBuffer) => unknown[];
      decodeImage: (b: ArrayBuffer, p: unknown) => void;
      toRGBA8: (p: unknown) => Uint8Array;
      encodeImage?: (
        rgba: Uint8Array,
        width: number,
        height: number,
        metadata?: Record<string, unknown>,
      ) => ArrayBuffer;
    };
  }
}
const MW = [250, 150, 100, 75, 50, 37, 25, 20, 15, 10];
const GRAPH_PALETTES = {
  nature: ["#4477AA", "#EE6677", "#228833", "#CCBB44", "#66CCEE", "#AA3377"],
  "okabe-ito": ["#0072B2", "#D55E00", "#009E73", "#E69F00", "#56B4E9", "#CC79A7"],
  gray: ["#222222", "#555555", "#888888", "#AAAAAA", "#CCCCCC", "#EEEEEE"],
};
const GRAPH_COLOR_CHOICES = [
  "#000000", "#555555", "#888888", "#BBBBBB", "#E5E5E5", "#FFFFFF",
  "#4477AA", "#66CCEE", "#228833", "#CCBB44", "#EE6677", "#AA3377",
  "#0072B2", "#56B4E9", "#009E73", "#E69F00", "#D55E00", "#CC79A7",
];
const GRAPH_COLOR_LABELS = [
  "黒", "濃い灰", "灰", "薄い灰", "淡い灰", "白",
  "青", "水色", "緑", "黄土", "赤", "紫",
  "濃青", "空色", "青緑", "橙", "朱", "赤紫",
];
const graphAxisScale = (maximum: number) => {
  const exponent = maximum >= 10000 ? Math.floor(Math.log10(maximum)) : 0;
  return { exponent, divisor: exponent ? 10 ** exponent : 1 };
};
const hexToRgb = (hex: string) => {
  const value = hex.replace("#", "").padEnd(6, "0").slice(0, 6);
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) || 0);
};
const rgbToHex = (rgb: number[]) =>
  `#${rgb.map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
const BUILTIN_MARKER_PRESETS: MarkerPreset[] = [
  {
    id: "all-blue",
    name: "Bio-Rad Precision Plus All Blue (1610373)",
    values: MW,
    builtIn: true,
  },
  {
    id: "bio-rad-dual-color",
    name: "Bio-Rad Precision Plus Dual Color (1610374)",
    values: MW,
    builtIn: true,
  },
  {
    id: "thermo-pageruler-plus",
    name: "Thermo PageRuler Plus (26619)",
    values: [250, 130, 100, 70, 55, 35, 25, 15, 10],
    builtIn: true,
  },
  {
    id: "thermo-pageruler",
    name: "Thermo PageRuler Prestained (26616)",
    values: [180, 130, 100, 70, 55, 40, 35, 25, 15, 10],
    builtIn: true,
  },
  {
    id: "neb-p7719",
    name: "NEB Color Prestained Broad Range (P7719)",
    values: [250, 180, 130, 95, 72, 55, 43, 34, 26, 17, 10],
    builtIn: true,
  },
  {
    id: "nacalai-protein-ladder-one-plus",
    name: "Nacalai Protein Ladder One Plus, Triple-color (19593)",
    values: [245, 180, 140, 100, 75, 60, 50, 40, 35, 30, 25, 20, 15, 10],
    builtIn: true,
  },
];
const MARKER_LIBRARY_KEY = "blotcanvas-marker-library-v1";
const AUTOSAVE_KEY = "blotcanvas-project-autosave-v1";
type AutosaveDraft = { savedAt: string; step: number; project: Project };
const uid = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2);
const defaultConditions = (lanes = 10): Condition[] => [
  {
    id: uid(),
    name: "siRNA",
    values: Array.from(
      { length: lanes },
      (_, i) => ["−", "−", "#1", "#2", "#3", "−"][i] || "",
    ),
    visible: true,
  },
];
const fresh = (): Project => ({
  version: 3,
  schemaVersion: 3,
  appVersion: "0.3.0-local",
  name: "Untitled WB figure",
  captures: [],
  cropX: 8,
  cropW: 60,
  gels: [
    {
      id: uid(),
      name: "Gel 1",
      width: 60,
      lanes: 0,
      conditions: [],
      laneCenter: 50,
      laneSpan: 100,
    },
  ],
  lanes: 0,
  conditions: [],
  order: [],
  fontFamily: "Helvetica",
  fontSize: 20,
  markerPresets: structuredClone(BUILTIN_MARKER_PRESETS),
  pageSize: isEnglishUi() ? "Letter" : "A4",
  panelWidthMm: 25.5,
  sourceRecordMode: "merge",
  labelSide: "antibody-left",
  syncGelOrder: false,
  quantification: {
    targets: [],
    normalizationRegionIds: {},
    valueMode: "correctedIntegrated",
    nonDetectMode: "nd",
    colors: {},
    graph: {
      type: "bar",
      fontFamily: "Helvetica",
      fontSize: 16,
      width: 700,
      height: 560,
      showValues: false,
      title: "",
      palette: "nature",
      customColors: [...GRAPH_PALETTES.nature],
    },
  },
});
const esc = (s: string) =>
  s.replace(
    /[<>&'"]/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;",
      })[c] || c,
  );
const autoLabelLayout = (value: string, width: number, size: number) => generalAutoLabelLayout(value, width, size, true);
const conditionLayouts = (
  row: Condition,
  gel: Gel,
  artWidth: number,
  fontSize: number,
) => {
  const laneWidth = (artWidth * (gel.laneSpan / 100)) / Math.max(1, gel.lanes),
    layouts: AutoLabelLayout[] = [];
  if (row.groups?.length)
    row.groups.forEach((group) =>
      layouts.push(
        autoLabelLayout(
          group.label,
          laneWidth * Math.max(1, group.span) - 8,
          fontSize,
        ),
      ),
    );
  else {
    const span = Math.max(1, row.groupSize || 1);
    for (let index = 0; index < gel.lanes; index += span)
      layouts.push(
        autoLabelLayout(
          row.values[index] || "",
          laneWidth * span - 8,
          fontSize,
        ),
      );
  }
  return layouts;
};
const conditionRowNeedsRotation = (
  row: Condition,
  gel: Gel,
  artWidth: number,
  fontSize: number,
) =>
  conditionLayouts(row, gel, artWidth, fontSize).some(
    (layout) => layout.mode === "rotate",
  );
const conditionRowHasWrap = (
  row: Condition,
  gel: Gel,
  artWidth: number,
  fontSize: number,
) =>
  conditionLayouts(row, gel, artWidth, fontSize).some(
    (layout) => layout.mode === "wrap",
  );
const conditionRowHeight = (
  row: Condition,
  gel: Gel,
  artWidth: number,
  fontSize: number,
) => {
  const layouts = conditionLayouts(row, gel, artWidth, fontSize);
  if (layouts.some((layout) => layout.mode === "rotate")) {
    const values = row.groups?.length ? row.groups.map(group => group.label)
      : Array.from({length: Math.ceil(gel.lanes / Math.max(1, row.groupSize || 1))}, (_, index) => row.values[index * Math.max(1, row.groupSize || 1)] || "");
    return Math.max(42, ...layouts.map((layout, index) =>
      figureLabelWidthEstimate(values[index] || "", fontSize * layout.fontScale) + 16));
  }
  const maximumLineCount = Math.max(
    1,
    ...layouts.map((layout) => layout.lines.length),
  );
  if (maximumLineCount > 1)
    return Math.max(42, fontSize * (maximumLineCount + 0.8));
  const hasSeparator = row.groups?.length
    ? row.groups.some((group) => groupShowsSeparator(row, group))
    : row.lineBelow && (row.groupSize || 1) > 1;
  return hasSeparator ? Math.max(40, fontSize * 2) : 30;
};
const svgAutoLabel = (
  value: string,
  x: number,
  y: number,
  availableWidth: number,
  fontSize: number,
  forceRotate = false,
) => {
  if (!value) return "";
  const layout = autoLabelLayout(value, availableWidth, fontSize);
  const effectiveSize = fontSize * layout.fontScale;
  if (forceRotate || layout.mode === "rotate")
    return `<text x="${x}" y="${y}" text-anchor="middle" class="cond" style="font-size:${effectiveSize}px" transform="rotate(-90 ${x} ${y})">${esc(value)}</text>`;
  if (layout.mode === "wrap")
    return `<text x="${x}" y="${y}" text-anchor="middle" class="cond" style="font-size:${effectiveSize}px">${layout.lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? -(layout.lines.length - 1) * effectiveSize * 0.525 : effectiveSize * 1.05}">${esc(line)}</tspan>`).join("")}</text>`;
  return `<text x="${x}" y="${y}" text-anchor="middle" class="cond" style="font-size:${effectiveSize}px">${esc(value)}</text>`;
};
type MarkerLabelPosition = {
  key?: string;
  mw: number;
  markerY: number;
  labelY: number;
};
const markerLabelPositions = (
  markers: { key?: string; mw: number; markerY: number }[],
  panelHeight: number,
  fontSize: number,
  minimumBoundary = 0,
  maximumBoundary = panelHeight,
): MarkerLabelPosition[] => {
  const sorted = [...markers]
    .sort((a, b) => a.markerY - b.markerY)
    .map((marker) => ({ ...marker, labelY: marker.markerY + fontSize * 0.35 }));
  if (!sorted.length) return [];
  const minimumY = Math.min(
      maximumBoundary,
      Math.max(minimumBoundary + fontSize, minimumBoundary + 4),
    ),
    maximumY = Math.max(minimumY, maximumBoundary - 2),
    desiredGap = fontSize + 3,
    gap =
      sorted.length > 1
        ? Math.min(desiredGap, Math.max(7, (maximumY - minimumY) / (sorted.length - 1)))
        : desiredGap;
  sorted[0].labelY = Math.max(minimumY, Math.min(maximumY, sorted[0].labelY));
  for (let index = 1; index < sorted.length; index++)
    sorted[index].labelY = Math.max(
      Math.min(maximumY, sorted[index].labelY),
      sorted[index - 1].labelY + gap,
    );
  if (sorted.at(-1)!.labelY > maximumY) {
    sorted.at(-1)!.labelY = maximumY;
    for (let index = sorted.length - 2; index >= 0; index--)
      sorted[index].labelY = Math.min(
        sorted[index].labelY,
        sorted[index + 1].labelY - gap,
      );
  }
  if (sorted[0].labelY < minimumY) {
    const shift = minimumY - sorted[0].labelY;
    sorted.forEach((marker) => (marker.labelY += shift));
  }
  return sorted;
};
const save = (name: string, data: string, type = "image/svg+xml") => {
  downloadBlob(name, new Blob([data], { type }));
};
const saveBlob = (name: string, blob: Blob) => {
  downloadBlob(name, blob);
};
const canvasBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("画像を生成できません"))),
      type,
      quality,
    ),
  );
const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
async function pngCanvasBlobWithDpi(
  canvas: HTMLCanvasElement,
  dpi = 300,
) {
  const blob = await canvasBlob(canvas, "image/png"),
    source = new Uint8Array(await blob.arrayBuffer());
  if (
    source.length < 33 ||
    source[0] !== 0x89 ||
    source[1] !== 0x50 ||
    source[2] !== 0x4e ||
    source[3] !== 0x47
  )
    return blob;
  const chunk = new Uint8Array(21),
    view = new DataView(chunk.buffer),
    pixelsPerMeter = Math.round(dpi / 0.0254);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4);
  view.setUint32(8, pixelsPerMeter);
  view.setUint32(12, pixelsPerMeter);
  chunk[16] = 1;
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  return new Blob([source.subarray(0, 33), chunk, source.subarray(33)], {
    type: "image/png",
  });
}
const joinBytes = (parts: Uint8Array[]) => {
  const output = new Uint8Array(
    parts.reduce((total, part) => total + part.length, 0),
  );
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
};
async function jpegPdf(jpeg: Blob, pixelWidth: number, pixelHeight: number) {
  const encoder = new TextEncoder(),
    image = new Uint8Array(await jpeg.arrayBuffer()),
    pageWidth = pixelWidth >= pixelHeight ? 842 : 595,
    pageHeight = (pageWidth * pixelHeight) / pixelWidth,
    content = `q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Im0 Do Q`,
    objects: (string | Uint8Array)[] = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
      joinBytes([
        encoder.encode(
          `<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`,
        ),
        image,
        encoder.encode("\nendstream"),
      ]),
      `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`,
    ],
    chunks: Uint8Array[] = [encoder.encode("%PDF-1.4\n%âãÏÓ\n")],
    offsets = [0];
  let length = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(length);
    const body = typeof object === "string" ? encoder.encode(object) : object,
      chunk = joinBytes([
        encoder.encode(`${index + 1} 0 obj\n`),
        body,
        encoder.encode("\nendobj\n"),
      ]);
    chunks.push(chunk);
    length += chunk.length;
  });
  const xrefOffset = length,
    xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, "0")} 00000 n `)
      .join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob(
    [...chunks, encoder.encode(xref)].map((bytes) =>
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer,
    ),
    { type: "application/pdf" },
  );
}
const bufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return btoa(binary);
};
const base64ToBuffer = (value: string) => {
  const binary = atob(value),
    bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
};

function loadUtif() {
  return new Promise<void>((ok, no) => {
    if (window.UTIF) return ok();
    const old = document.querySelector(
      "script[data-utif]",
    ) as HTMLScriptElement | null;
    if (old) {
      old.addEventListener("load", () => ok());
      return;
    }
    const s = document.createElement("script");
    s.dataset.utif = "1";
    s.src = "https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.min.js";
    s.onload = () => ok();
    s.onerror = () =>
      no(
        new Error(
          "TIFF decoderを読み込めません。インターネット接続を確認してください。",
        ),
      );
    document.head.appendChild(s);
  });
}
async function readImage(file: File): Promise<Img> {
  if (/\.tiff?$/i.test(file.name)) {
    await loadUtif();
    const b = await file.arrayBuffer(),
      pages = window.UTIF!.decode(b);
    if (!pages.length) throw new Error(`${file.name}を読めません`);
    window.UTIF!.decodeImage(b, pages[0]);
    const p = pages[0] as {
      width: number;
      height: number;
      t258?: number[];
    };
    const rgba = window.UTIF!.toRGBA8(pages[0]);
    const c = document.createElement("canvas");
    c.width = p.width;
    c.height = p.height;
    c.getContext("2d")!.putImageData(
      new ImageData(new Uint8ClampedArray(rgba), p.width, p.height),
      0,
      0,
    );
    return {
      name: file.name,
      data: c.toDataURL("image/png"),
      width: p.width,
      height: p.height,
      relativePath: file.webkitRelativePath,
      tiffData: bufferToBase64(b),
      bitsPerSample: p.t258?.[0] || 8,
      fileSize: file.size,
      lastModified: file.lastModified,
    };
  }
  return new Promise((ok, no) => {
    const r = new FileReader();
    r.onerror = no;
    r.onload = () => {
      const i = new Image();
      i.onerror = no;
      i.onload = () =>
        ok({
          name: file.name,
          data: String(r.result),
          width: i.naturalWidth,
          height: i.naturalHeight,
          relativePath: file.webkitRelativePath,
          fileSize: file.size,
          lastModified: file.lastModified,
        });
      i.src = String(r.result);
    };
    r.readAsDataURL(file);
  });
}

async function createWorkingMerge(signal: Img, brightfield: Img): Promise<Img> {
  if (signal.width !== brightfield.width || signal.height !== brightfield.height)
    throw new Error(
      `作業用Mergeを生成できません。シグナル画像（${signal.width}×${signal.height}）と明視野／マーカー画像（${brightfield.width}×${brightfield.height}）の画素寸法が一致している必要があります。`,
    );
  const load = (source: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = source;
    });
  const [signalImage, brightfieldImage] = await Promise.all([
      load(signal.data),
      load(brightfield.data),
    ]),
    canvas = document.createElement("canvas");
  canvas.width = signal.width;
  canvas.height = signal.height;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(brightfieldImage, 0, 0);
  const base = context.getImageData(0, 0, canvas.width, canvas.height);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(signalImage, 0, 0);
  const chemiluminescence = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    ),
    samples: number[] = [];
  for (let index = 0; index < chemiluminescence.data.length; index += 64) {
    samples.push(
      0.2126 * chemiluminescence.data[index] +
        0.7152 * chemiluminescence.data[index + 1] +
        0.0722 * chemiluminescence.data[index + 2],
    );
  }
  samples.sort((a, b) => a - b);
  const low = samples[Math.floor(samples.length * 0.02)] ?? 0,
    median = samples[Math.floor(samples.length * 0.5)] ?? 0,
    high = samples[Math.floor(samples.length * 0.995)] ?? 255,
    brightSignal = median < 127,
    span = Math.max(1, high - low);
  for (let index = 0; index < base.data.length; index += 4) {
    const luminance =
        0.2126 * chemiluminescence.data[index] +
        0.7152 * chemiluminescence.data[index + 1] +
        0.0722 * chemiluminescence.data[index + 2],
      normalized = Math.max(0, Math.min(1, (luminance - low) / span)),
      strength = brightSignal ? normalized : 1 - normalized,
      darken = 1 - 0.82 * Math.pow(strength, 0.8);
    base.data[index] = Math.round(base.data[index] * darken);
    base.data[index + 1] = Math.round(base.data[index + 1] * darken);
    base.data[index + 2] = Math.round(base.data[index + 2] * darken);
  }
  context.putImageData(base, 0, 0);
  return {
    name: `${signal.name.replace(/\.(tiff?|png|jpe?g)$/i, "")}_working-merge.png`,
    data: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
    derivedFromRoles: ["cl", "m"],
  };
}
function parseKnownName(name: string) {
  const lumino = name.match(
    /^(.*?)(\d+)(?:_Sum_?(\d+))?_?(CL|Merge|M)\.(tiff?|png|jpe?g)$/i,
  );
  if (lumino)
    return {
      prefix: lumino[1],
      n: Number(lumino[2]),
      digits: lumino[2].length,
      sum: lumino[3] ? Number(lumino[3]) : 0,
      kind: lumino[4].toLowerCase() as "cl" | "merge" | "m",
      generic: false,
    };
  const generic = name.match(
    /^(.*?)[_\-\s]+(CL|Chemi|Chemiluminescence|Signal|Merge|Merged|Composite|RGB|Color|Marker|Markers|M)\.(tiff?|png|jpe?g)$/i,
  );
  if (!generic) return null;
  const role = generic[2].toLowerCase();
  return {
    prefix: generic[1],
    n: 0,
    digits: 0,
    sum: 0,
    kind: /^(merge|merged|composite|rgb|color)$/.test(role)
      ? ("merge" as const)
      : /^(marker|markers|m)$/.test(role)
        ? ("m" as const)
        : ("cl" as const),
    generic: true,
  };
}
function parseGenericName(name: string) {
  const stem = name.replace(/\.(tiff?|png|jpe?g)$/i, "");
  return {
    prefix: stem,
    n: 0,
    digits: 0,
    sum: 0,
    kind: "cl" as const,
    generic: true,
  };
}
const naturalShotCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
function folderInfo(img: Img) {
  const parts = (img.relativePath || "").split("/").filter(Boolean),
    folders = parts.slice(1, -1),
    folder = folders.join("/");
  const parent = folders.at(-1) || "";
  const antibodies = /^\d{6,8}(?:[_-]\d+)?$/.test(parent)
    ? []
    : parent
        .split(/[\-,，、]+/)
        .map((s) => s.trim())
        .filter(Boolean);
  return { folder, antibodies };
}
function markers(values = MW) {
  return values.map((mw, i) => ({
    mw,
    on: false,
    y: 8 + i * 9.2,
    placed: false,
  }));
}
function markersForPreset(old: Marker[], values: number[]) {
  return values.map((mw, i) => {
    const found = old.find((item) => item.mw === mw);
    return (
      found || {
        mw,
        on: false,
        y: 8 + i * (84 / Math.max(1, values.length - 1)),
        placed: false,
      }
    );
  });
}
function markerPresetIdFor(markers: Marker[], presets: MarkerPreset[]) {
  const values = markers.map((marker) => marker.mw);
  return presets.find(
    (preset) =>
      preset.values.length === values.length &&
      preset.values.every((value, index) => value === values[index]),
  )?.id;
}
async function pixels(img: Img, maxW = 900) {
  const im = await new Promise<HTMLImageElement>((ok, no) => {
    const z = new Image();
    z.onload = () => ok(z);
    z.onerror = no;
    z.src = img.data;
  });
  const c = document.createElement("canvas"),
    scale = Math.min(1, maxW / im.naturalWidth);
  c.width = Math.max(1, Math.round(im.naturalWidth * scale));
  c.height = Math.max(1, Math.round(im.naturalHeight * scale));
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(im, 0, 0, c.width, c.height);
  return {
    data: g.getImageData(0, 0, c.width, c.height).data,
    w: c.width,
    h: c.height,
  };
}
async function detectGeometry(img: Img) {
  const { data, w, h } = await pixels(img);
  const gray = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return (data[i] + data[i + 1] + data[i + 2]) / 3;
  };
  const col = Array.from({ length: w }, (_, x) => {
    let s = 0;
    for (let y = 0; y < h; y += 3) s += 255 - gray(x, y);
    return s;
  });
  const lane = (from: number, to: number) => {
    let bx = from,
      bv = -1;
    for (let x = from + 8; x < to - 8; x++) {
      let v = 0;
      for (let k = -4; k <= 4; k++) v += col[x + k] || 0;
      if (v > bv) {
        bv = v;
        bx = x;
      }
    }
    return bx;
  };
  const lx = lane(0, Math.round(w * 0.3)),
    rx = lane(Math.round(w * 0.7), w);
  const profile = (cx: number) =>
    Array.from({ length: h }, (_, y) => {
      let s = 0,
        n = 0;
      for (
        let x = Math.max(0, cx - 10);
        x <= Math.min(w - 1, cx + 10);
        x += 2
      ) {
        s += 255 - gray(x, y);
        n++;
      }
      return s / n;
    });
  const peaks = (a: number[]) => {
    const base = a.slice().sort((x, y) => x - y)[Math.floor(a.length * 0.55)];
    return a
      .map((v, i) => ({ v, i }))
      .filter(
        (q, i) =>
          i > 5 &&
          i < a.length - 6 &&
          q.v > base + 12 &&
          q.v === Math.max(...a.slice(i - 5, i + 6)),
      )
      .sort((a, b) => b.v - a.v)
      .slice(0, 14)
      .sort((a, b) => a.i - b.i);
  };
  const L = peaks(profile(lx)),
    R = peaks(profile(rx)),
    pairs: { l: number; r: number }[] = [];
  for (const l of L) {
    let best = R[0],
      d = Infinity;
    for (const r of R) {
      const z = Math.abs(l.i - r.i);
      if (z < d) {
        d = z;
        best = r;
      }
    }
    if (best && d < h * 0.035) pairs.push({ l: l.i, r: best.i });
  }
  const angle = pairs.length
    ? pairs.reduce(
        (s, q) => s + (Math.atan2(q.r - q.l, rx - lx) * 180) / Math.PI,
        0,
      ) / pairs.length
    : 0;
  const ys = pairs.map((q) => ((q.l + q.r) / 2 / h) * 100);
  return { angle: -angle, ys, laneX: [(lx / w) * 100, (rx / w) * 100] };
}
async function adjustedData(img: Img, levels: Levels, invert: boolean) {
  const im = await new Promise<HTMLImageElement>((ok, no) => {
      const z = new Image();
      z.onload = () => ok(z);
      z.onerror = no;
      z.src = img.data;
    }),
    c = document.createElement("canvas");
  c.width = im.naturalWidth;
  c.height = im.naturalHeight;
  const g = c.getContext("2d")!;
  g.drawImage(im, 0, 0);
  const q = g.getImageData(0, 0, c.width, c.height),
    span = Math.max(1, levels.high - levels.low);
  for (let i = 0; i < q.data.length; i += 4) {
    let v = Math.max(0, Math.min(1, (q.data[i] - levels.low) / span));
    v = Math.pow(v, 1 / levels.gamma);
    let z = Math.round(v * 255);
    if (invert) z = 255 - z;
    q.data[i] = q.data[i + 1] = q.data[i + 2] = z;
  }
  g.putImageData(q, 0, 0);
  return c.toDataURL("image/png");
}
async function autoLevels(
  img: Img,
  invert: boolean,
  bounds?: { x: number; y: number; w: number; h: number },
) {
  const { data, w, h } = await pixels(img, 900),
    hist = Array(256).fill(0);
  const x0 = Math.max(0, Math.floor(((bounds?.x || 0) * w) / 100)),
    x1 = Math.min(
      w,
      Math.ceil((((bounds?.x || 0) + (bounds?.w || 100)) * w) / 100),
    ),
    y0 = Math.max(0, Math.floor(((bounds?.y || 0) * h) / 100)),
    y1 = Math.min(
      h,
      Math.ceil((((bounds?.y || 0) + (bounds?.h || 100)) * h) / 100),
    );
  for (let y = y0; y < y1; y += 2)
    for (let x = x0; x < x1; x += 2) {
      const i = (y * w + x) * 4;
      hist[Math.round((data[i] + data[i + 1] + data[i + 2]) / 3)]++;
    }
  const total = hist.reduce((a, b) => a + b, 0),
    quant = (p: number) => {
      let s = 0;
      for (let i = 0; i < 256; i++) {
        s += hist[i];
        if (s >= total * p) return i;
      }
      return 255;
    };
  let low = quant(0.002),
    high = quant(0.998);
  if (high - low < 8) high = Math.min(255, low + 24);
  const levels = { low, high, gamma: 1 };
  return { levels, preview: await adjustedData(img, levels, invert) };
}

async function originalGrayPixels(img: Img) {
  if (img.tiffData) {
    await loadUtif();
    const buffer = base64ToBuffer(img.tiffData),
      pages = window.UTIF!.decode(buffer);
    if (pages.length) {
      window.UTIF!.decodeImage(buffer, pages[0]);
      const page = pages[0] as {
          width: number;
          height: number;
          data: Uint8Array;
          isLE?: boolean;
          t258?: number[];
        },
        bits = page.t258?.[0] || 8,
        samples = page.t258?.length || 1;
      if (samples === 1 && (bits === 8 || bits === 16)) {
        const values = new Float64Array(page.width * page.height);
        if (bits === 8)
          for (let index = 0; index < values.length; index++) values[index] = page.data[index];
        else
          for (let index = 0; index < values.length; index++) {
            const offset = index * 2;
            values[index] = page.isLE
              ? page.data[offset] | (page.data[offset + 1] << 8)
              : (page.data[offset] << 8) | page.data[offset + 1];
          }
        return { values, width: page.width, height: page.height, maximum: 2 ** bits - 1, bits };
      }
    }
  }
  const decoded = await pixels(img, Number.POSITIVE_INFINITY),
    values = new Float64Array(decoded.w * decoded.h);
  for (let index = 0; index < values.length; index++) {
    const offset = index * 4;
    values[index] =
      0.2126 * decoded.data[offset] +
      0.7152 * decoded.data[offset + 1] +
      0.0722 * decoded.data[offset + 2];
  }
  return { values, width: decoded.w, height: decoded.h, maximum: 255, bits: 8 };
}

async function rawAdjustedData(img: Img, range: RawDisplayRange) {
  const raw = await originalGrayPixels(img),
    canvas = document.createElement("canvas");
  canvas.width = raw.width;
  canvas.height = raw.height;
  const context = canvas.getContext("2d")!,
    output = context.createImageData(raw.width, raw.height);
  for (let index = 0; index < raw.values.length; index++) {
    const value = mapRawToDisplay(raw.values[index], range),
      offset = index * 4;
    output.data[offset] = output.data[offset + 1] = output.data[offset + 2] = value;
    output.data[offset + 3] = 255;
  }
  context.putImageData(output, 0, 0);
  return canvas.toDataURL("image/png");
}

async function rotatedPreviewData(
  data: string,
  width: number,
  height: number,
  angle: number,
) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = data;
    }),
    canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.translate(width / 2, height / 2);
  context.rotate((angle * Math.PI) / 180);
  context.drawImage(image, -width / 2, -height / 2, width, height);
  return canvas.toDataURL("image/png");
}

async function filteredPreviewData(
  data: string,
  width: number,
  height: number,
  brightness: number,
  contrast: number,
) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = data;
    }),
    canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}

function rawValuesInCorrectedRect(
  raw: Awaited<ReturnType<typeof originalGrayPixels>>,
  rect: { x: number; y: number; w: number; h: number },
  rotation: number,
) {
  const sampled: number[] = [],
    stride = Math.max(1, Math.floor(Math.sqrt(raw.values.length / 300_000)));
  for (let y = 0; y < raw.height; y += stride)
    for (let x = 0; x < raw.width; x += stride) {
      const corrected = sourcePointToCorrected(
        { x: (x / raw.width) * 100, y: (y / raw.height) * 100 },
        rotation,
        raw.width,
        raw.height,
      );
      if (
        corrected.x >= rect.x &&
        corrected.x <= rect.x + rect.w &&
        corrected.y >= rect.y &&
        corrected.y <= rect.y + rect.h
      )
        sampled.push(raw.values[y * raw.width + x]);
    }
  return sampled;
}

export default function Home() {
  useUiTranslation();
  const [p, setP] = useState<Project>(fresh);
  const [step, setStep] = useState(1);
  const [active, setActive] = useState("");
  const [activeGelId, setActiveGelId] = useState("");
  const [regionId, setRegionId] = useState("");
  const [notice, setNotice] = useState("");
  const [deviceMode, setDeviceMode] = useState<"atto" | "manual">("atto");
  const [manualPool, setManualPool] = useState<Img[]>([]);
  const [manualSetName, setManualSetName] = useState("");
  const [manualRoles, setManualRoles] = useState({ cl: "", merge: "", m: "" });
  const [manualGeneratedMerge, setManualGeneratedMerge] = useState<Img>();
  const [antibodyDrafts, setAntibodyDrafts] = useState<Record<string, string>>(
    {},
  );
  const [align, setAlign] = useState<
    Record<string, { x: number; y: number }[]>
  >({});
  const [markerStep, setMarkerStep] = useState<Record<string, number>>({});
  const [pairTemplate, setPairTemplate] = useState<
    Record<
      string,
      {
        expressions: string;
        pair: string;
        groupLabel?: string;
        pairLabel?: string;
      }
    >
  >({});
  const [sirnaTemplate, setSirnaTemplate] = useState<
    Record<string, { target: string; negative: string; sequences: string }>
  >({});
  const [simpleTemplate, setSimpleTemplate] = useState<
    Record<string, { label: string; values: string }>
  >({});
  const [plusMinusName, setPlusMinusName] = useState<Record<string, string>>(
    {},
  );
  const [activeMarkerPreset, setActiveMarkerPreset] = useState("all-blue");
  const [markerLibraryReady, setMarkerLibraryReady] = useState(false);
  const [reuseMarkerSelection, setReuseMarkerSelection] = useState(true);
  const [newMarkerPreset, setNewMarkerPreset] = useState({
    name: "",
    values: "",
  });
  const [viewAuto, setViewAuto] = useState<Record<string, string>>({});
  const [capturePreviewRole, setCapturePreviewRole] = useState<
    Record<string, "merge" | "cl" | "m">
  >({});
  const [conditionCellSelection, setConditionCellSelection] = useState<{
    gelId: string;
    rowId: string;
    anchorRowId?: string;
    endRowId?: string;
    start: number;
    end: number;
  }>();
  const [conditionEditMode, setConditionEditMode] = useState<
    "template" | "free"
  >("free");
  const [conditionHistory, setConditionHistory] = useState<
    ConditionHistoryState[]
  >([]);
  const [conditionFuture, setConditionFuture] = useState<
    ConditionHistoryState[]
  >([]);
  const [adjustmentBusy, setAdjustmentBusy] = useState("");
  const [conditionWorkspaceView, setConditionWorkspaceView] = useState<
    "table" | "figure"
  >("table");
  const [conditionGelId, setConditionGelId] = useState("");
  const [quantActiveRegionId, setQuantActiveRegionId] = useState("");
  const [quantPreviews, setQuantPreviews] = useState<Record<string, string>>({});
  const [quantBusy, setQuantBusy] = useState(false);
  const [quantZoom, setQuantZoom] = useState(100);
  const [quantProfileLane, setQuantProfileLane] = useState(1);
  const [quantLaneProfile, setQuantLaneProfile] =
    useState<QuantLaneProfile>();
  const [quantProfileBusy, setQuantProfileBusy] = useState(false);
  const [graphColorKey, setGraphColorKey] = useState("");
  const [figurePreviewReadable, setFigurePreviewReadable] = useState(false);
  const [figurePreviewPanels, setFigurePreviewPanels] = useState<{gelId: string; data: string; width: number}[]>([]);
  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [compactUi, setCompactUi] = useState(false);
  const [pendingLinkedProject, setPendingLinkedProject] =
    useState<Project | null>(null);
  const [pendingProjectFileName, setPendingProjectFileName] = useState("");
  const [autosaveDraft, setAutosaveDraft] = useState<AutosaveDraft | null>(
    null,
  );
  const [autosaveReady, setAutosaveReady] = useState(false);
  const files = useRef<HTMLInputElement>(null),
    folderFiles = useRef<HTMLInputElement>(null),
    projectFile = useRef<HTMLInputElement>(null),
    relinkFolderFiles = useRef<HTMLInputElement>(null),
    conditionFile = useRef<HTMLInputElement>(null),
    asidePane = useRef<HTMLElement>(null),
    stagePane = useRef<HTMLElement>(null),
    drag = useRef<{
      x: number;
      y: number;
      mode?: string;
      cid?: string;
      rid?: string;
      gelId?: string;
      ox?: number;
      oy?: number;
      ow?: number;
      oh?: number;
    } | null>(null),
    quantDrag = useRef<{
      regionId: string;
      roiId: string;
      mode: "move" | "resize";
      offsetX: number;
      offsetY: number;
    } | null>(null);
  const cap = p.captures.find((x) => x.id === active) || p.captures[0];
  const region = cap?.regions.find((r) => r.id === regionId) || cap?.regions[0];
  const allRegions = useMemo(() => {
    const entries = p.captures.flatMap((c) =>
        c.regions.map((r) => ({ c, r })),
      ),
      byId = new Map(entries.map((entry) => [entry.r.id, entry]));
    return canonicalRegionOrder(
      p.order,
      entries.map((entry) => entry.r),
    )
      .map((id) => byId.get(id))
      .filter(Boolean) as { c: Capture; r: Region }[];
  }, [p]);
  const stepTargets = useMemo(() => {
    if (step === 2 || step === 3)
      return p.captures.flatMap((capture) =>
        (capture.assignedGelIds === undefined
          ? p.gels.map((gel) => gel.id)
          : capture.assignedGelIds
        ).map((gelId) => ({
          captureId: capture.id,
          gelId,
          regionId: "",
        })),
      );
    if (step === 4 || step === 5)
      return allRegions.map(({ c, r }) => ({
        captureId: c.id,
        gelId: r.gelId,
        regionId: r.id,
      }));
    return [];
  }, [allRegions, p.captures, step]);
  const stepTargetIndex = Math.max(
    0,
    stepTargets.findIndex(
      (target) =>
        target.captureId === cap?.id &&
        (!target.gelId || target.gelId === (region?.gelId || activeGelId)) &&
        (!target.regionId || target.regionId === region?.id),
    ),
  );
  function navigateStepTarget(offset: number) {
    if (!stepTargets.length) return;
    const target = stepTargets[
      (stepTargetIndex + offset + stepTargets.length) % stepTargets.length
    ];
    setActive(target.captureId);
    setActiveGelId(target.gelId);
    if (target.regionId) setRegionId(target.regionId);
  }
  function selectWorkflowStep(nextStep: number) {
    const nextProject = structuredClone(p);
    if (nextStep === 3) ensureInitialRegions(nextProject);
    if (nextStep === 3) setP(nextProject);

    const entries = nextProject.captures.flatMap((capture) =>
        capture.regions.map((targetRegion) => ({
          capture,
          region: targetRegion,
        })),
      ),
      byId = new Map(entries.map((entry) => [entry.region.id, entry])),
      orderedEntries = canonicalRegionOrder(
        nextProject.order,
        entries.map((entry) => entry.region),
      )
        .map((id) => byId.get(id))
        .filter(Boolean) as { capture: Capture; region: Region }[],
      firstCapture = nextProject.captures[0],
      firstAssignedGel = firstCapture
        ? nextProject.gels.find((gel) =>
            (firstCapture.assignedGelIds ?? nextProject.gels.map((item) => item.id)).includes(
              gel.id,
            ),
          )
        : undefined,
      firstRegion =
        nextStep >= 6
          ? orderedEntries.find(
              (entry) => entry.region.gelId === nextProject.gels[0]?.id,
            ) || orderedEntries[0]
          : orderedEntries[0];

    if (nextStep <= 3 && firstCapture) {
      setActive(firstCapture.id);
      setActiveGelId(firstAssignedGel?.id || nextProject.gels[0]?.id || "");
      const firstCaptureRegion = firstCapture.regions.find(
        (targetRegion) => targetRegion.gelId === firstAssignedGel?.id,
      );
      setRegionId(firstCaptureRegion?.id || firstCapture.regions[0]?.id || "");
    } else if (firstRegion) {
      setActive(firstRegion.capture.id);
      setActiveGelId(firstRegion.region.gelId);
      setRegionId(firstRegion.region.id);
    }
    if (nextStep === 6 || nextStep === 7)
      setConditionGelId(firstRegion?.region.gelId || nextProject.gels[0]?.id || "");
    setStep(nextStep);
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => {
        asidePane.current?.scrollTo({ top: 0, behavior: "smooth" });
        stagePane.current?.scrollTo({ top: 0, behavior: "smooth" });
      }),
    );
  }
  const workflowStatus = useMemo(() => {
    type WorkflowState = {
      kind: "complete" | "attention" | "available" | "none";
      symbol: string;
      title: string;
    };
    const none = (title: string): WorkflowState => ({
        kind: "none",
        symbol: "",
        title,
      }),
      complete = (title: string): WorkflowState => ({
        kind: "complete",
        symbol: "✓",
        title,
      }),
      attention = (title: string): WorkflowState => ({
        kind: "attention",
        symbol: "!",
        title,
      }),
      available = (title: string): WorkflowState => ({
        kind: "available",
        symbol: "•",
        title,
      }),
      hasCaptures = p.captures.length > 0,
      allSignalsReady =
        hasCaptures && p.captures.every((capture) => Boolean(capture.cl)),
      alignmentTargets = p.captures
        .filter((capture) => Boolean(capture.merge))
        .flatMap((capture) =>
          p.gels
            .filter(
              (gel) =>
                capture.assignedGelIds === undefined ||
                capture.assignedGelIds.includes(gel.id),
            )
            .map((gel) => ({
              capture,
              gelId: gel.id,
            })),
        ),
      alignedCount = alignmentTargets.filter(({ capture, gelId }) =>
        Object.prototype.hasOwnProperty.call(
          capture.gelRotations || {},
          gelId,
        ),
      ).length,
      allAligned =
        alignmentTargets.length > 0 &&
        alignedCount === alignmentTargets.length,
      hasRegions = allRegions.length > 0,
      allAdjusted =
        hasRegions && allRegions.every(({ r }) => Boolean(r.adjustment)),
      allMarkersPlaced =
        hasRegions &&
        allRegions.every(
          ({ r }) =>
            p.gels.find((gel) => gel.id === r.gelId)?.markerState === "none" ||
            r.markers.some((marker) => marker.on && marker.placed),
        ),
      conditionsReady =
        hasRegions &&
        p.gels.length > 0 &&
        p.gels.every(
          (gel) =>
            gel.lanes > 0 &&
            gel.conditions.some(
              (condition) =>
                condition.visible && condition.values.length >= gel.lanes,
            ),
        ),
      hasMeasurements = Boolean(
        p.quantification?.targets.some(
          (target) => target.measurements.length > 0,
        ),
      );
    return [
      allSignalsReady
        ? complete(`${p.captures.length}撮影セットを読み込み済み`)
        : hasCaptures
          ? attention("シグナル画像が不足している撮影セットがあります")
          : none("撮影セットを読み込むと状態を表示します"),
      allAligned
        ? complete(`${alignmentTargets.length}画像・ゲルの水平を確認済み`)
        : hasCaptures
          ? attention(
              alignedCount
                ? `水平補正が未確認です（${alignedCount}/${alignmentTargets.length}）`
                : "各画像・ゲルの水平を目視確認してください",
            )
          : none("撮影セットの読み込み後に確認します"),
      hasRegions
        ? complete(`${allRegions.length}領域を設定済み`)
        : hasCaptures
          ? attention("切り出し領域が未設定です")
          : none("撮影セットの読み込み後に設定します"),
      allAdjusted
        ? complete("全領域のFigure用輝度を設定済み")
        : hasRegions
          ? attention("Figure用輝度を未調整の領域があります")
          : none("領域指定後に調整します"),
      allMarkersPlaced
        ? complete("全領域に分子量マーカーを配置済み")
        : hasRegions
          ? attention("マーカー位置が未設定の領域があります")
          : none("領域指定後に設定します"),
      conditionsReady
        ? complete("レーン数と条件行を設定済み")
        : hasRegions
          ? attention("レーン条件を確認してください")
          : none("領域指定後に設定します"),
      hasRegions && conditionsReady
        ? available("Figureを書き出せます")
        : none("領域と条件表の設定後に書き出せます"),
      hasMeasurements
        ? complete("定量結果を保存済み")
        : hasRegions
          ? available("定量化は任意です")
          : none("領域指定後に利用できます"),
      hasMeasurements
        ? available("測定値からグラフを作成できます")
        : none("定量化後に利用できます"),
    ] satisfies WorkflowState[];
  }, [allRegions, p]);
  useEffect(() => {
    setCompactUi(localStorage.getItem("blotcanvas-display-mode") === "compact");
    try {
      const stored = JSON.parse(
        localStorage.getItem(AUTOSAVE_KEY) || "null",
      ) as AutosaveDraft | null;
      if (
        stored?.project &&
        [2, 3].includes(stored.project.version) &&
        stored.project.captures?.length
      )
        setAutosaveDraft(stored);
    } catch {
      localStorage.removeItem(AUTOSAVE_KEY);
    }
    setAutosaveReady(true);
  }, []);
  useEffect(() => {
    if (
      !autosaveReady ||
      autosaveDraft ||
      pendingLinkedProject ||
      !p.captures.length
    )
      return;
    const persist = () => {
      try {
        localStorage.setItem(
          AUTOSAVE_KEY,
          JSON.stringify({
            savedAt: new Date().toISOString(),
            step,
            project: createLinkedProjectSnapshot(p),
          } satisfies AutosaveDraft),
        );
      } catch {
        // Explicit project JSON remains available if browser storage is full.
      }
    };
    const timer = window.setTimeout(persist, 1500),
      saveWhenHidden = () => {
        if (document.visibilityState === "hidden") persist();
      };
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", saveWhenHidden);
    };
  }, [autosaveDraft, autosaveReady, p, pendingLinkedProject, step]);
  useEffect(() => {
    if (!p.captures.length) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [p.captures.length]);
  useEffect(() => {
    if (step !== 6) return;
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if ((event.key === "Delete" || event.key === "Backspace") && conditionCellSelection) {
        const focused = document.activeElement as HTMLElement | null;
        if (
          focused instanceof HTMLInputElement ||
          focused instanceof HTMLTextAreaElement ||
          focused?.isContentEditable
        )
          return;
        event.preventDefault();
        const selection = conditionCellSelection;
        conditionCheckpoint();
        patch((project) => {
          const gel = project.gels.find((item) => item.id === selection.gelId);
          if (!gel) return project;
          const anchor = gel.conditions.findIndex(
              (item) => item.id === (selection.anchorRowId || selection.rowId),
            ),
            endRow = gel.conditions.findIndex(
              (item) => item.id === (selection.endRowId || selection.rowId),
            );
          gel.conditions
            .slice(Math.min(anchor, endRow), Math.max(anchor, endRow) + 1)
            .forEach((row) => {
              row.values = Array.from({ length: gel.lanes }, (_, lane) => {
                const group = row.groups?.find(
                  (item) => lane >= item.start && lane < item.start + item.span,
                );
                return group
                  ? lane === group.start
                    ? group.label
                    : ""
                  : row.values[lane] || "";
              });
              row.groups = undefined;
              for (
                let lane = Math.min(selection.start, selection.end);
                lane <= Math.max(selection.start, selection.end);
                lane++
              )
                row.values[lane] = "";
            });
          return project;
        });
        return;
      }
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undoConditionEdit();
      } else if (
        event.key.toLowerCase() === "y" ||
        (event.key.toLowerCase() === "z" && event.shiftKey)
      ) {
        event.preventDefault();
        redoConditionEdit();
      }
    };
    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  });
  useEffect(() => {
    localStorage.setItem(
      "blotcanvas-display-mode",
      compactUi ? "compact" : "standard",
    );
  }, [compactUi]);
  useEffect(() => {
    if (step !== 6 && step !== 7) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      Promise.all(p.gels.map(async gel => {
        const canvas = await renderFigureCanvas(1, gel.id);
        return {gelId: gel.id, data: canvas.toDataURL("image/png"), width: canvas.width};
      })).then(panels => {
        if (!cancelled) setFigurePreviewPanels(panels);
      }).catch(() => { if (!cancelled) { setFigurePreviewPanels([]); setNotice("Figureプレビューを生成できませんでした"); } });
    }, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [p, step]);
  const gelWidth = (gelId: string) =>
    p.gels.find((g) => g.id === gelId)?.width ?? p.cropW;
  const figureMarkers = (region: Region) =>
    p.gels.find((gel) => gel.id === region.gelId)?.markerState === "none"
      ? []
      : region.markers;
  useEffect(() => {
    if ("serviceWorker" in navigator && window.location.protocol === "https:") {
      navigator.serviceWorker
        .register(new URL("sw.js", document.baseURI).pathname)
        .catch(() => undefined);
    }
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const rememberPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const markInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", rememberPrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", rememberPrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(MARKER_LIBRARY_KEY) || "null") as {
        presets?: MarkerPreset[];
        activeId?: string;
      } | null;
      if (stored?.presets?.length) {
        const storedPresets = stored.presets;
        patch((project) => {
          const byId = new Map<string, MarkerPreset>();
          [...BUILTIN_MARKER_PRESETS, ...project.markerPresets, ...storedPresets].forEach(
            (preset) =>
              byId.set(preset.id, {
                ...byId.get(preset.id),
                ...preset,
                values: [...preset.values],
              }),
          );
          project.markerPresets = [...byId.values()];
          return project;
        });
        if (stored.activeId) setActiveMarkerPreset(stored.activeId);
      }
    } catch {
      // Keep the built-in library if browser storage is unavailable or corrupt.
    } finally {
      setMarkerLibraryReady(true);
    }
  }, []);
  useEffect(() => {
    if (!markerLibraryReady) return;
    try {
      localStorage.setItem(
        MARKER_LIBRARY_KEY,
        JSON.stringify({
          presets: p.markerPresets,
          activeId: activeMarkerPreset,
        }),
      );
    } catch {
      // Project JSON remains the fallback when browser storage is unavailable.
    }
  }, [activeMarkerPreset, markerLibraryReady, p.markerPresets]);
  useEffect(() => setManualGeneratedMerge(undefined), [manualRoles.cl, manualRoles.m]);
  useEffect(() => {
    let cancelled = false;
    const jobs = p.captures.flatMap((c) =>
      (["merge", "m"] as const)
        .filter((kind) => c[kind] && !viewAuto[`${c.id}:${kind}`])
        .map(async (kind) => {
          const q = await autoLevels(c[kind]!, false);
          return [`${c.id}:${kind}`, q.preview] as const;
        }),
    );
    if (jobs.length)
      Promise.all(jobs).then((entries) => {
        if (!cancelled)
          setViewAuto((old) => ({ ...old, ...Object.fromEntries(entries) }));
      });
    return () => {
      cancelled = true;
    };
  }, [p.captures, viewAuto]);
  const patch = (fn: (x: Project) => Project) =>
    setP((x) => fn(structuredClone(x)));
  const patchCap = (id: string, values: Partial<Capture>) =>
    patch((x) => {
      const c = x.captures.find((v) => v.id === id);
      if (c) Object.assign(c, values);
      return x;
    });
  const patchRegion = (cid: string, rid: string, values: Partial<Region>) =>
    patch((x) => {
      const r = x.captures
        .find((c) => c.id === cid)
        ?.regions.find((v) => v.id === rid);
      if (r) Object.assign(r, values);
      return x;
    });
  const conditionState = (project: Project): ConditionHistoryState => ({
    gels: project.gels.map((gel) => ({
      id: gel.id,
      lanes: gel.lanes,
      laneCenter: gel.laneCenter,
      laneSpan: gel.laneSpan,
      conditions: structuredClone(gel.conditions),
    })),
  });
  const restoreConditionState = (
    project: Project,
    snapshot: ConditionHistoryState,
  ): Project => ({
    ...project,
    gels: project.gels.map((gel) => {
      const saved = snapshot.gels.find((item) => item.id === gel.id);
      return saved
        ? {
            ...gel,
            lanes: saved.lanes,
            laneCenter: saved.laneCenter,
            laneSpan: saved.laneSpan,
            conditions: structuredClone(saved.conditions),
          }
        : gel;
    }),
  });
  const updateConditionRow = (
    gelId: string,
    rowId: string,
    update: (row: Condition) => void,
  ) =>
    setP((project) => ({
      ...project,
      gels: project.gels.map((gel) =>
        gel.id !== gelId
          ? gel
          : {
              ...gel,
              conditions: gel.conditions.map((row) => {
                if (row.id !== rowId) return row;
                const next = structuredClone(row);
                update(next);
                return next;
              }),
            },
      ),
    }));
  const captureGelIds = (capture: Capture) =>
    capture.assignedGelIds === undefined
      ? p.gels.map((gel) => gel.id)
      : capture.assignedGelIds.filter((id) =>
          p.gels.some((gel) => gel.id === id),
        );
  const captureGels = (capture: Capture) => {
    const ids = new Set(captureGelIds(capture));
    return p.gels.filter((gel) => ids.has(gel.id));
  };

  function setCaptureGelAssignment(captureId: string, gelId: string, on: boolean) {
    const currentCapture = p.captures.find((item) => item.id === captureId);
    if (
      !on &&
      currentCapture &&
      captureGelIds(currentCapture).length === 1 &&
      captureGelIds(currentCapture)[0] === gelId
    ) {
      setNotice("撮影セットには少なくとも1つのゲルを割り当ててください");
      return;
    }
    patch((project) => {
      const capture = project.captures.find((item) => item.id === captureId);
      if (!capture) return project;
      const current = new Set(
        capture.assignedGelIds ?? project.gels.map((gel) => gel.id),
      );
      if (on) current.add(gelId);
      else current.delete(gelId);
      capture.assignedGelIds = project.gels
        .map((gel) => gel.id)
        .filter((id) => current.has(id));
      return project;
    });
  }

  function assignAllCapturesToAllGels() {
    patch((project) => {
      const gelIds = project.gels.map((gel) => gel.id);
      project.captures.forEach((capture) => {
        capture.assignedGelIds = [...gelIds];
      });
      return project;
    });
    setNotice("すべての撮影に全ゲルを割り当てました");
  }

  function assignCapturesByOrder() {
    patch((project) => {
      project.captures.forEach((capture, index) => {
        const gel = project.gels[index];
        capture.assignedGelIds = gel ? [gel.id] : [];
        capture.regions.forEach((region) => {
          if (gel) region.gelId = gel.id;
        });
      });
      return project;
    });
    setNotice("撮影順に、1撮影＝1ゲルとして割り当てました");
  }

  function excludeCaptureImage(captureId: string, role: "cl" | "merge" | "m") {
    patch((project) => {
      const capture = project.captures.find((item) => item.id === captureId);
      if (capture) capture[role] = undefined;
      return project;
    });
    setNotice(
      `${role === "cl" ? "シグナル／CL" : role === "merge" ? "Merge" : "マーカー／M"}をプロジェクトから外しました（元ファイルは削除されません）`,
    );
  }

  function excludeCapture(captureId: string) {
    const remaining = p.captures.filter((capture) => capture.id !== captureId),
      removedRegionIds = new Set(
        p.captures.find((capture) => capture.id === captureId)?.regions.map((r) => r.id) || [],
      );
    patch((project) => {
      project.captures = project.captures.filter((capture) => capture.id !== captureId);
      project.order = project.order.filter((id) => !removedRegionIds.has(id));
      if (project.quantification)
        project.quantification.targets = project.quantification.targets.filter(
          (target) => !removedRegionIds.has(target.regionId),
        );
      return project;
    });
    if (active === captureId) setActive(remaining[0]?.id || "");
    if (removedRegionIds.has(regionId)) setRegionId("");
    setNotice("撮影セットをプロジェクトから除外しました（元ファイルは削除されません）");
  }

  async function importFiles(e: ChangeEvent<HTMLInputElement>) {
    try {
      const selected = Array.from(e.target.files || [])
        .filter((file) => /\.(tiff?|png|jpe?g)$/i.test(file.name))
        .sort(
          (a, b) =>
            a.lastModified - b.lastModified ||
            naturalShotCompare(a.name, b.name),
        );
      if (selected.length)
        patch((project) => {
          if (isDefaultProjectName(project.name))
            project.name = projectNameFromFiles(selected);
          return project;
        });
      setNotice("画像ファイルとフォルダ名を解析しています…");
      if (deviceMode === "manual") {
        const imgs = await Promise.all(selected.map(readImage));
        const roleIndex = (role: "cl" | "merge" | "m") => {
          const i = imgs.findIndex((img) => parseKnownName(img.name)?.kind === role);
          return i < 0 ? "" : String(i);
        };
        const first = imgs[0];
        setManualPool(imgs);
        setManualSetName(
          first
            ? folderInfo(first).folder.split("/").at(-1) ||
                first.name.replace(/\.(tiff?|png|jpe?g)$/i, "")
            : "",
        );
        setManualRoles({
          cl: roleIndex("cl") || (imgs.length ? "0" : ""),
          merge: roleIndex("merge"),
          m: roleIndex("m"),
        });
        setNotice(`${imgs.length}件を読み込みました。下の欄で画像の役割を確認してください`);
        setTimeout(() => setNotice(""), 5000);
        e.target.value = "";
        return;
      }
      const recognized = selected.filter((file) => {
          const q = parseKnownName(file.name);
          return q && !q.generic;
        }),
        ignored = selected.length - recognized.length;
      const imgs = await Promise.all(recognized.map(readImage));
      patch((x) => {
        const parsed = imgs.map((img) => ({
          img,
          q: parseKnownName(img.name)!,
          meta: folderInfo(img),
        }));
        for (const { img, q, meta } of parsed) {
          if (q.kind === "m") continue;
          const shot = q.digits
              ? `${q.prefix}${String(q.n).padStart(q.digits, "0")}`
              : q.prefix,
            key = q.sum ? `${shot} · Sum ${q.sum}` : shot;
          let c = x.captures.find(
            (v) => v.key === key && v.folder === meta.folder,
          );
          if (!c) {
            c = {
              id: uid(),
              key,
              folder: meta.folder,
              antibodies: meta.antibodies,
              rotation: 0,
              gelRotations: {},
              brightness: 100,
              contrast: 100,
              invert: true,
              regions: [],
            };
            x.captures.push(c);
          } else
            c.antibodies = [...new Set([...c.antibodies, ...meta.antibodies])];
          if (q.kind === "cl") c.cl = img;
          else c.merge = img;
        }
        for (const { img, q, meta } of parsed) {
          if (q.kind !== "m") continue;
          const candidates = x.captures.filter((c) => {
            const z = c.key.match(/^(.*?)(\d+)(?: · Sum \d+)?$/);
            return (
              c.folder === meta.folder &&
              ((q.digits > 0 &&
                z &&
                z[1] === q.prefix &&
                Number(z[2]) < q.n &&
                Number(z[2]) >= q.n - 2) ||
                (q.digits === 0 && c.key === q.prefix))
            );
          });
          const targets = candidates.length
            ? candidates
            : x.captures.filter(
                (c) => c.folder === meta.folder && c.key.startsWith(q.prefix),
              );
          targets.forEach((c) => (c.m = img));
        }
        x.captures.sort(
          (a, b) =>
            naturalShotCompare(a.key, b.key) ||
            naturalShotCompare(a.folder || "", b.folder || ""),
        );
        return x;
      });
      setNotice(
        `${imgs.length}件をATTO撮影セットとして読み込み、フォルダ名から抗体候補を登録しました（${ignored}件は無視）`,
      );
      setTimeout(() => setNotice(""), 5000);
    } catch (err) {
      setNotice(String(err));
    }
    e.target.value = "";
  }
  async function generateManualMerge() {
    const signal = manualPool[Number(manualRoles.cl)],
      brightfield = manualPool[Number(manualRoles.m)];
    if (manualRoles.cl === "" || !signal || manualRoles.m === "" || !brightfield) {
      setNotice("シグナル画像と明視野／マーカー画像を選択してください");
      return undefined;
    }
    try {
      setNotice("作業用Mergeを生成しています…");
      const generated = await createWorkingMerge(signal, brightfield);
      setManualGeneratedMerge(generated);
      setNotice("作業用Mergeを生成しました。元画像は変更していません");
      return generated;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "作業用Mergeの生成に失敗しました");
      return undefined;
    }
  }
  async function addManualCapture() {
    const clIndex = Number(manualRoles.cl);
    if (manualRoles.cl === "" || !manualPool[clIndex]) {
      setNotice("シグナル画像を選択してください");
      return;
    }
    const cl = manualPool[clIndex],
      meta = folderInfo(cl),
      base =
        manualSetName.trim() || cl.name.replace(/\.(tiff?|png|jpe?g)$/i, "");
    let workingMerge = manualGeneratedMerge;
    if (
      manualRoles.merge === "" &&
      manualRoles.m !== "" &&
      !workingMerge
    ) {
      workingMerge = await generateManualMerge();
      if (!workingMerge) return;
    }
    let createdId = "";
    patch((project) => {
      let key = base,
        suffix = 2;
      while (project.captures.some((c) => c.key === key && c.folder === meta.folder))
        key = `${base} (${suffix++})`;
      createdId = uid();
      project.captures.push({
        id: createdId,
        key,
        folder: meta.folder,
        antibodies: meta.antibodies,
        cl,
        merge:
          manualRoles.merge === ""
            ? workingMerge
            : manualPool[Number(manualRoles.merge)],
        m:
          manualRoles.m === "" ? undefined : manualPool[Number(manualRoles.m)],
        rotation: 0,
        gelRotations: {},
        brightness: 100,
        contrast: 100,
        invert: true,
        regions: [],
      });
      return project;
    });
    setActive(createdId);
    setManualGeneratedMerge(undefined);
    setNotice(`「${base}」を撮影セットに追加しました`);
  }
  function nextRegionAssignment(capture: Capture) {
    const antibodies = [
        ...new Set(
          [...capture.antibodies, ...capture.regions.map((r) => r.antibody)]
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ],
      antibodyList = antibodies.length ? antibodies : ["Target"],
      combinations = antibodyList.flatMap((antibody) =>
        captureGels(capture).map((gel) => ({ gel, antibody })),
      );
    const preferredGel = activeGelId
      ? combinations.find(
          ({ gel, antibody }) =>
            gel.id === activeGelId &&
            !capture.regions.some(
              (region) =>
                region.gelId === gel.id && region.antibody === antibody,
            ),
        )
      : undefined;
    return (
      preferredGel ||
      combinations.find(
        ({ gel, antibody }) =>
          !capture.regions.some(
            (region) =>
              region.gelId === gel.id && region.antibody === antibody,
          ),
      ) ||
      combinations[capture.regions.length % combinations.length] || {
        gel: p.gels[0],
        antibody: antibodyList[0],
      }
    );
  }
  function ensureInitialRegions(project: Project) {
    const preset =
      project.markerPresets.find((item) => item.id === activeMarkerPreset) ||
      project.markerPresets[0];
    project.captures.forEach((capture) => {
      const assignedIds = new Set(
        capture.assignedGelIds ?? project.gels.map((gel) => gel.id),
      );
      project.gels
        .filter((gel) => assignedIds.has(gel.id))
        .forEach((gel) => {
          if (capture.regions.some((targetRegion) => targetRegion.gelId === gel.id))
            return;
          const height = 20,
            source = capture.merge || capture.cl,
            targetRegion: Region = {
              id: uid(),
              name: `Blot ${capture.regions.length + 1}`,
              x: Math.min(project.cropX, 100 - gel.width),
              y: 30,
              h: height,
              gelId: gel.id,
              antibody: capture.antibodies[0] || "Target",
              markers: markers(preset?.values ?? MW),
              markerPresetId: preset?.id ?? "all-blue",
              rotation: capture.gelRotations?.[gel.id] ?? capture.rotation,
              adjustment: capture.cl
                ? {
                    mode: "minmax",
                    min: 0,
                    max: 2 ** (capture.cl.bitsPerSample || 8) - 1,
                    bitDepth: capture.cl.bitsPerSample || 8,
                    linked: true,
                    brightness: 100,
                    contrast: 100,
                    invert: capture.invert,
                  }
                : undefined,
            };
          if (source)
            targetRegion.sourceCorners = correctedRectSourceCorners(
              {
                x: targetRegion.x,
                y: targetRegion.y,
                width: gel.width,
                height,
              },
              targetRegion.rotation || 0,
              source.width,
              source.height,
            );
          capture.regions.push(targetRegion);
          project.order.push(targetRegion.id);
        });
    });
    project.order = canonicalRegionOrder(
      project.order,
      project.captures.flatMap((capture) => capture.regions),
    );
  }
  function addRegion() {
    if (!cap) return;
    const previous = cap.regions.at(-1),
      assignment = nextRegionAssignment(cap),
      gel = assignment.gel,
      sameAntibody = cap.regions.find(
        (region) => region.antibody === assignment.antibody,
      ),
      markerPreset = p.markerPresets.find(
        (preset) => preset.id === activeMarkerPreset,
      ),
      initialWidth = gel.width,
      r: Region = {
        id: uid(),
        name: `Blot ${cap.regions.length + 1}`,
        x: Math.min(
          (sameAntibody?.x ?? previous?.x ?? p.cropX) + (previous ? 1.5 : 0),
          100 - initialWidth,
        ),
        y: Math.min(
          (sameAntibody?.y ?? previous?.y ?? 30) + (previous ? 2 : 0),
          100 - (sameAntibody?.h ?? previous?.h ?? 20),
        ),
        h: sameAntibody?.h ?? previous?.h ?? 20,
        gelId: gel.id,
        antibody: assignment.antibody,
        markers: markers(markerPreset?.values ?? MW),
        markerPresetId: markerPreset?.id ?? "all-blue",
        rotation: cap.gelRotations?.[gel.id] ?? cap.rotation,
        adjustment: cap.cl
          ? {
              mode: "minmax",
              min: 0,
              max: 2 ** (cap.cl.bitsPerSample || 8) - 1,
              bitDepth: cap.cl.bitsPerSample || 8,
              linked: true,
              brightness: 100,
              contrast: 100,
              invert: cap.invert,
            }
          : undefined,
      };
    const source = cap.merge || cap.cl;
    if (source)
      r.sourceCorners = correctedRectSourceCorners(
        { x: r.x, y: r.y, width: initialWidth, height: r.h },
        r.rotation || 0,
        source.width,
        source.height,
      );
    patch((x) => {
      const c = x.captures.find((v) => v.id === cap.id)!;
      c.regions.push(r);
      x.order.push(r.id);
      return x;
    });
    setRegionId(r.id);
    setActiveGelId(gel.id);
  }
  function addGel() {
    patch((x) => {
      const lanes = x.gels.at(-1)?.lanes ?? 0;
      x.gels.push({
        id: uid(),
        name: `Gel ${x.gels.length + 1}`,
        width: x.gels.at(-1)?.width ?? 84,
        lanes,
        conditions: [],
        laneCenter: 50,
        laneSpan: 100,
      });
      return x;
    });
  }
  function setGelWidth(gelId: string, width: number) {
    patch((x) => {
      const g = x.gels.find((v) => v.id === gelId);
      if (g) g.width = width;
      x.captures.forEach((c) =>
        c.regions
          .filter((r) => r.gelId === gelId)
          .forEach((r) => (r.x = Math.min(r.x, 100 - width))),
      );
      return x;
    });
  }
  function setRegionHeight(cid: string, rid: string, height: number) {
    patch((x) => {
      const target = x.captures
        .find((c) => c.id === cid)!
        .regions.find((r) => r.id === rid)!;
      const antibody = target.antibody;
      target.h = height;
      x.captures.forEach((c) =>
        c.regions
          .filter((r) => r.antibody === antibody && r.id !== rid)
          .forEach((r) => {
            r.h = height;
            r.y = Math.min(r.y, 100 - height);
          }),
      );
      return x;
    });
  }
  function removeRegion(cid: string, rid: string) {
    patch((x) => {
      const c = x.captures.find((v) => v.id === cid)!;
      c.regions = c.regions.filter((r) => r.id !== rid);
      x.order = x.order.filter((id) => id !== rid);
      return x;
    });
  }
  function pointerDown(e: PointerEvent<HTMLDivElement>, c: Capture, gelId?: string) {
    const b = e.currentTarget.getBoundingClientRect();
    drag.current = {
      x: ((e.clientX - b.left) / b.width) * 100,
      y: ((e.clientY - b.top) / b.height) * 100,
      mode: "new",
      cid: c.id,
      gelId,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setActive(c.id);
    if (gelId) setActiveGelId(gelId);
  }
  function editDown(
    e: PointerEvent<HTMLButtonElement>,
    c: Capture,
    r: Region,
    mode: string,
  ) {
    e.stopPropagation();
    const board = e.currentTarget.closest(".imageWrap") as HTMLElement,
      b = board.getBoundingClientRect();
    drag.current = {
      x: ((e.clientX - b.left) / b.width) * 100,
      y: ((e.clientY - b.top) / b.height) * 100,
      mode,
      cid: c.id,
      rid: r.id,
      ox: r.x ?? p.cropX,
      oy: r.y,
      ow: gelWidth(r.gelId),
      oh: r.h,
    };
    board.setPointerCapture(e.pointerId);
    setActive(c.id);
    setRegionId(r.id);
  }
  function editMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d?.mode || d.mode === "new") return;
    const b = e.currentTarget.getBoundingClientRect(),
      x = ((e.clientX - b.left) / b.width) * 100,
      y = ((e.clientY - b.top) / b.height) * 100,
      dx = x - d.x,
      dy = y - d.y;
    let nx = d.ox!,
      ny = d.oy!,
      nw = d.ow!,
      nh = d.oh!;
    if (d.mode === "move") {
      nx = Math.max(0, Math.min(100 - nw, nx + dx));
      ny = Math.max(0, Math.min(100 - nh, ny + dy));
    } else {
      if (d.mode.includes("l")) {
        nx = Math.max(0, Math.min(nx + nw - 3, nx + dx));
        nw = d.ow! + (d.ox! - nx);
      }
      if (d.mode.includes("r"))
        nw = Math.max(3, Math.min(100 - nx, d.ow! + dx));
      if (d.mode.includes("t")) {
        ny = Math.max(0, Math.min(ny + nh - 3, ny + dy));
        nh = d.oh! + (d.oy! - ny);
      }
      if (d.mode.includes("b"))
        nh = Math.max(3, Math.min(100 - ny, d.oh! + dy));
    }
    patch((v) => {
      const rr = v.captures
          .find((c) => c.id === d.cid)!
          .regions.find((r) => r.id === d.rid)!,
        g = v.gels.find((g) => g.id === rr.gelId);
      if (g) g.width = nw;
      v.captures.forEach((c) =>
        c.regions
          .filter((r) => r.gelId === rr.gelId)
          .forEach((r) => (r.x = Math.min(r.x, 100 - nw))),
      );
      rr.x = nx;
      rr.y = ny;
      const antibody = rr.antibody;
      v.captures.forEach((c) =>
        c.regions
          .filter((r) => r.antibody === antibody)
          .forEach((r) => {
            r.h = nh;
            r.y = Math.min(r.y, 100 - nh);
          }),
      );
      rr.y = ny;
      const capture = v.captures.find((c) => c.id === d.cid)!,
        source = capture.merge || capture.cl;
      if (source)
        rr.sourceCorners = correctedRectSourceCorners(
          { x: rr.x, y: rr.y, width: nw, height: rr.h },
          rr.rotation ?? capture.rotation,
          source.width,
          source.height,
        );
      rr.needsReview = false;
      return v;
    });
  }
  function editUp(e: PointerEvent<HTMLDivElement>) {
    if (drag.current?.mode) drag.current = null;
    else pointerUp(e);
  }
  function alignClick(
    e: PointerEvent<HTMLDivElement>,
    c: Capture,
    gelId: string,
  ) {
    const b = e.currentTarget.getBoundingClientRect(),
      pt = {
        x: ((e.clientX - b.left) / b.width) * 100,
        y: ((e.clientY - b.top) / b.height) * 100,
      },
      key = `${c.id}:${gelId}`;
    setAlign((v) => ({ ...v, [key]: [pt] }));
    setActive(c.id);
    setGelRotation(
      c.id,
      gelId,
      c.gelRotations?.[gelId] ?? c.rotation,
    );
    setNotice("基準にするマーカーバンドへ水平線を置きました");
  }
  function setGelRotation(captureId: string, gelId: string, rotation: number) {
    patch((project) => {
      const capture = project.captures.find((c) => c.id === captureId)!;
      capture.gelRotations ??= {};
      capture.gelRotations[gelId] = rotation;
      capture.regions
        .filter((region) => region.gelId === gelId)
        .forEach((region) => {
          region.rotation = rotation;
          region.needsReview = true;
          const source = capture.merge || capture.cl;
          if (source)
            region.sourceCorners = correctedRectSourceCorners(
              {
                x: region.x,
                y: region.y,
                width: project.gels.find((gel) => gel.id === gelId)?.width || 1,
                height: region.h,
              },
              rotation,
              source.width,
              source.height,
            );
        });
      return project;
    });
    setActive(captureId);
    setActiveGelId(gelId);
  }
  async function autoClFor(c: Capture, r: Region) {
    if (!c.cl) return;
    setAdjustmentBusy(r.id);
    setNotice(`${c.key}・${r.antibody}の切出し領域を解析しています…`);
    try {
      const raw = await originalGrayPixels(c.cl),
        sampled = rawValuesInCorrectedRect(
          raw,
          { x: r.x, y: r.y, w: gelWidth(r.gelId), h: r.h },
          r.rotation ?? c.rotation,
        ),
        base = rawPercentileRange(sampled.length ? sampled : raw.values, raw.bits),
        range = {
          ...base,
          invert: r.adjustment?.invert ?? c.invert,
        };
      await applyRawRange(c, r, range, true);
      setNotice(
        `${c.key}・${r.antibody}: Min ${range.min} / Max ${range.max}（${range.bitDepth}-bit元画素値）`,
      );
    } finally {
      setAdjustmentBusy("");
    }
  }
  async function applyRawRange(
    c: Capture,
    r: Region,
    range: RawDisplayRange,
    autoApplied = false,
  ) {
    const sourceMaximum = 2 ** range.bitDepth - 1;
    range = {
      ...range,
      min: Math.max(0, Math.min(range.min, sourceMaximum - 1)),
      max: Math.max(1, Math.min(range.max, sourceMaximum)),
    };
    if (range.max <= range.min) {
      if (range.min < sourceMaximum) range.max = range.min + 1;
      else range.min = range.max - 1;
    }
    const link = r.adjustment?.linked !== false,
      group = adjustmentGroupKey(r.antibody, range.bitDepth),
      candidates = p.captures.flatMap((capture) =>
        capture.regions
          .filter((region) => capture.cl)
          .map((region) => ({ capture, region })),
      ),
      targets = link
        ? candidates.filter(
            ({ capture, region }) =>
              region.adjustment?.linked !== false &&
              adjustmentGroupKey(
                region.antibody,
                capture.cl?.bitsPerSample || 8,
              ) === group,
          )
        : [{ capture: c, region: r }],
      computed = await Promise.all(
        targets.map(async ({ capture, region }) => {
          const raw = await originalGrayPixels(capture.cl!),
            localRange = { ...range, bitDepth: raw.bits },
            preview = await rawAdjustedData(capture.cl!, localRange),
            values = rawValuesInCorrectedRect(
              raw,
              {
                x: region.x,
                y: region.y,
                w: gelWidth(region.gelId),
                h: region.h,
              },
              region.rotation ?? capture.rotation,
            ),
            stats = rawClipStatistics(values.length ? values : raw.values, localRange);
          return { capture, region, preview, stats, range: localRange };
        }),
      );
    patch((project) => {
      computed.forEach(({ capture, region, preview, stats, range: localRange }) => {
        const target = project.captures
          .find((item) => item.id === capture.id)!
          .regions.find((item) => item.id === region.id)!;
        target.adjustment = {
          mode: "minmax",
          min: localRange.min,
          max: localRange.max,
          bitDepth: localRange.bitDepth,
          linked: target.adjustment?.linked !== false,
          autoApplied,
          ...stats,
          preview,
          brightness: 100,
          contrast: 100,
          invert: localRange.invert,
        };
      });
      return project;
    });
  }
  function patchAntibodyAdjustment(
    antibody: string,
    values: Partial<Adjustment>,
  ) {
    patch((project) => {
      project.captures.forEach((capture) =>
        capture.regions
          .filter((region) => region.antibody === antibody)
          .forEach((region) => {
            const old = region.adjustment;
            region.adjustment = {
              brightness: old?.brightness ?? capture.brightness,
              contrast: old?.contrast ?? capture.contrast,
              invert: old?.invert ?? capture.invert,
              levels: old?.levels,
              preview: old?.preview,
              ...values,
            };
          }),
      );
      return project;
    });
  }
  function resetAntibodyAdjustment(antibody: string) {
    const entry = allRegions.find(
      ({ c, r }) => r.antibody === antibody && c.cl,
    );
    if (!entry?.c.cl) return;
    const bits = entry.c.cl.bitsPerSample || 8;
    void applyRawRange(entry.c, entry.r, {
      min: 0,
      max: 2 ** bits - 1,
      bitDepth: bits,
      invert: entry.r.adjustment?.invert ?? entry.c.invert,
    });
    setNotice(`${antibody}を元画像の全階調範囲へリセットしました`);
  }
  function markerClickFor(
    e: PointerEvent<HTMLDivElement>,
    c: Capture,
    r: Region,
  ) {
    const queue = r.markers.filter((m) => m.on).sort((a, b) => b.mw - a.mw),
      index = markerStep[r.id] || 0;
    if (!queue.length) {
      setActive(c.id);
      setRegionId(r.id);
      setNotice("左側で、このメンブレンに表示する分子量を選択してください");
      return;
    }
    if (index >= queue.length) {
      setNotice(
        "選択したマーカーはすべて配置済みです。やり直す場合は「配置をリセット」を押してください",
      );
      return;
    }
    const b = e.currentTarget.getBoundingClientRect(),
      y = ((e.clientY - b.top) / b.height) * 100,
      a = structuredClone(r.markers),
      mw = queue[index].mw,
      m = a.find((v) => v.mw === mw)!;
    m.y = y;
    m.detected = false;
    m.placed = true;
    const source = c.m || c.merge || c.cl;
    if (source)
      m.sourceLine = [
        { x: 0, y },
        { x: 100, y },
      ].map((point) =>
        correctedRectSourceCorners(
          { x: point.x, y: point.y, width: 0, height: 0 },
          r.rotation ?? c.rotation,
          source.width,
          source.height,
        )[0],
      ) as [NormalizedPoint, NormalizedPoint];
    patchRegion(c.id, r.id, { markers: a });
    patch((project) => {
      const gel = project.gels.find((item) => item.id === r.gelId);
      if (gel) gel.markerState = "configured";
      return project;
    });
    setMarkerStep((old) => ({ ...old, [r.id]: index + 1 }));
    setActive(c.id);
    setRegionId(r.id);
    setNotice(`${c.key}・${r.name}: ${mw} kDaを配置しました`);
  }
  function setMarkerSelected(c: Capture, r: Region, mw: number, on: boolean) {
    patch((project) => {
      const regions = reuseMarkerSelection
        ? project.captures.flatMap((capture) => capture.regions)
        : [
            project.captures
              .find((capture) => capture.id === c.id)!
              .regions.find((region) => region.id === r.id)!,
          ];
      regions.forEach((region) => {
        const marker = region.markers.find((item) => item.mw === mw);
        if (marker) marker.on = on;
        region.markers.forEach((item) => (item.placed = false));
      });
      return project;
    });
    setMarkerStep({});
  }
  function applyMarkerPreset(presetId = activeMarkerPreset) {
    if (!cap || !region) return;
    const preset = p.markerPresets.find(
      (item) => item.id === presetId,
    );
    if (!preset) return;
    patch((project) => {
      const usedPreset = project.markerPresets.find(
        (item) => item.id === presetId,
      );
      if (usedPreset) usedPreset.lastUsedAt = Date.now();
      const targets = reuseMarkerSelection
        ? project.captures.flatMap((capture) => capture.regions)
        : [
            project.captures
              .find((capture) => capture.id === cap.id)!
              .regions.find((item) => item.id === region.id)!,
          ];
      targets.forEach((target) => {
        const old = target.markers;
        target.markerPresetId = preset.id;
        target.markers = markersForPreset(old, preset.values);
      });
      return project;
    });
    setMarkerStep({});
    setNotice(`${preset.name}を適用しました`);
  }
  function selectMarkerPreset(presetId: string) {
    setActiveMarkerPreset(presetId);
    applyMarkerPreset(presetId);
  }
  function registerMarkerPreset() {
    const values = newMarkerPreset.values
      .split(/[,，、\s]+/)
      .map(Number)
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => b - a);
    if (!newMarkerPreset.name.trim() || !values.length) {
      setNotice("マーカー名と分子量一覧を入力してください");
      return;
    }
    const id = uid();
    patch((project) => {
      const preset: MarkerPreset = {
        id,
        name: newMarkerPreset.name.trim(),
        values,
        lastUsedAt: Date.now(),
      };
      project.markerPresets.push(preset);
      const targets =
        cap && region
          ? reuseMarkerSelection
            ? project.captures.flatMap((capture) => capture.regions)
            : [
                project.captures
                  .find((capture) => capture.id === cap.id)!
                  .regions.find((item) => item.id === region.id)!,
              ]
          : [];
      targets.forEach((target) => {
        target.markerPresetId = preset.id;
        target.markers = markersForPreset(target.markers, preset.values);
      });
      return project;
    });
    setActiveMarkerPreset(id);
    setNewMarkerPreset({ name: "", values: "" });
    setMarkerStep({});
    setNotice("新しいマーカーパターンを登録して適用しました");
  }
  function removeMarkerPreset() {
    const preset = p.markerPresets.find(
      (item) => item.id === activeMarkerPreset,
    );
    if (!preset || preset.builtIn) return;
    patch((project) => {
      project.markerPresets = project.markerPresets.filter(
        (item) => item.id !== preset.id,
      );
      return project;
    });
    setActiveMarkerPreset("all-blue");
    setNotice(`${preset.name}を登録一覧から削除しました`);
  }
  function pointerUp(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    if (d.mode !== "new") {
      drag.current = null;
      return;
    }
    const b = e.currentTarget.getBoundingClientRect(),
      x = ((e.clientX - b.left) / b.width) * 100,
      y = ((e.clientY - b.top) / b.height) * 100,
      c = p.captures.find((v) => v.id === d.cid);
    const x1 = Math.max(0, Math.min(d.x, x)),
      x2 = Math.min(100, Math.max(d.x, x)),
      y1 = Math.max(0, Math.min(d.y, y)),
      y2 = Math.min(100, Math.max(d.y, y));
    drag.current = null;
    if (!c || x2 - x1 < 3 || y2 - y1 < 2) return;
    const fallback = nextRegionAssignment(c),
      preferredGel = p.gels.find((gel) => gel.id === d.gelId),
      preferredAntibody = c.antibodies.find(
        (antibody) =>
          !c.regions.some(
            (region) =>
              region.gelId === preferredGel?.id &&
              region.antibody === antibody,
          ),
      ),
      assignment = preferredGel
        ? { gel: preferredGel, antibody: preferredAntibody || fallback.antibody }
        : fallback,
      gel = assignment.gel;
    if (!gel) return;
    const r: Region = {
      id: uid(),
      name: `Blot ${c.regions.length + 1}`,
      x: x1,
      y: y1,
      h: y2 - y1,
      gelId: gel.id,
      antibody: assignment.antibody,
      markers: markers(
        p.markerPresets.find((preset) => preset.id === activeMarkerPreset)
          ?.values ?? MW,
      ),
      markerPresetId: activeMarkerPreset,
      rotation: c.gelRotations?.[gel.id] ?? c.rotation,
      adjustment: c.cl
        ? {
            mode: "minmax",
            min: 0,
            max: 2 ** (c.cl.bitsPerSample || 8) - 1,
            bitDepth: c.cl.bitsPerSample || 8,
            linked: true,
            brightness: 100,
            contrast: 100,
            invert: c.invert,
          }
        : undefined,
    };
    const source = c.merge || c.cl;
    if (source)
      r.sourceCorners = correctedRectSourceCorners(
        { x: r.x, y: r.y, width: x2 - x1, height: r.h },
        r.rotation || 0,
        source.width,
        source.height,
      );
    patch((v) => {
      v.gels.find((g) => g.id === gel.id)!.width = x2 - x1;
      v.captures.forEach((z) =>
        z.regions
          .filter((rr) => rr.gelId === gel.id)
          .forEach((rr) => (rr.x = Math.min(rr.x ?? v.cropX, 100 - (x2 - x1)))),
      );
      v.captures.find((z) => z.id === c.id)!.regions.push(r);
      v.order.push(r.id);
      return v;
    });
    setRegionId(r.id);
    setActiveGelId(gel.id);
  }
  function lanes(gelId: string, n: number) {
    n = Math.max(0, Math.min(40, Number.isFinite(n) ? n : 0));
    const current = p.gels.find((gel) => gel.id === gelId);
    if (!current || current.lanes === n) return;
    const removesContent =
      n < current.lanes &&
      current.conditions.some(
        (row) =>
          row.values.slice(n).some((value) => value.trim()) ||
          row.groups?.some((group) => group.start + group.span > n),
      );
    if (
      removesContent &&
      !window.confirm(
        `Lane ${n + 1}以降の値または結合範囲が削除されます。レーン数を${n}へ変更しますか？`,
      )
    )
      return;
    conditionCheckpoint();
    patch((x) => {
      const g = x.gels.find((v) => v.id === gelId)!;
      resizeLaneGrid(g, n);
      return x;
    });
    setConditionCellSelection((selection) =>
      selection?.gelId === gelId
        ? {
            ...selection,
            start: Math.max(0, Math.min(selection.start, n - 1)),
            end: Math.max(0, Math.min(selection.end, n - 1)),
          }
        : selection,
    );
  }
  function conditionCheckpoint() {
    setConditionHistory((history) => [
      ...history.slice(-49),
      conditionState(p),
    ]);
    setConditionFuture([]);
  }
  function undoConditionEdit() {
    const previous = conditionHistory.at(-1);
    if (!previous) return;
    setConditionFuture((future) => [conditionState(p), ...future].slice(0, 50));
    setConditionHistory((history) => history.slice(0, -1));
    setP((project) => restoreConditionState(project, previous));
  }
  function redoConditionEdit() {
    const next = conditionFuture[0];
    if (!next) return;
    setConditionHistory((history) => [
      ...history.slice(-49),
      conditionState(p),
    ]);
    setConditionFuture((future) => future.slice(1));
    setP((project) => restoreConditionState(project, next));
  }
  function pasteConditionCells(
    event: ClipboardEvent<HTMLInputElement>,
    gelId: string,
    rowIndex: number,
    laneStart: number,
  ) {
    const rows = parseClipboardGrid(event.clipboardData.getData("text/plain"));
    if (!rows.length || (rows.length === 1 && rows[0].length === 1)) return;
    event.preventDefault();
    const gelBeforePaste = p.gels.find((gel) => gel.id === gelId)!,
      requiredLanes = laneStart + Math.max(...rows.map((row) => row.length));
    if (
      requiredLanes > gelBeforePaste.lanes &&
      !window.confirm(
        `貼り付けには${requiredLanes}レーン必要です。レーン数を${gelBeforePaste.lanes}から${requiredLanes}へ増やしますか？`,
      )
    )
      return;
    const mergeConflict = rows.some((values, rowOffset) =>
      gelBeforePaste.conditions[rowIndex + rowOffset]?.groups?.some(
        (group) =>
          group.span > 1 &&
          group.start < laneStart + values.length &&
          group.start + group.span > laneStart,
      ),
    );
    if (
      mergeConflict &&
      !window.confirm(
        "貼り付け範囲が既存の結合セルと重なります。重なる結合を解除して貼り付けますか？",
      )
    )
      return;
    conditionCheckpoint();
    patch((project) => {
      const gel = project.gels.find((item) => item.id === gelId)!;
      pasteGrid(gel, rowIndex, laneStart, rows, (index, laneCount) => ({
        id: uid(),
        name: `Condition ${index + 1}`,
        values: Array(laneCount).fill(""),
        visible: true,
      }));
      return project;
    });
    setNotice(`${rows.length}行 × ${Math.max(...rows.map((row) => row.length))}列を貼り付けました`);
  }
  function pasteConditionRowsWithNames(
    event: ClipboardEvent<HTMLInputElement>,
    gelId: string,
    rowIndex: number,
  ) {
    const rows = parseClipboardGrid(event.clipboardData.getData("text/plain"));
    if (!rows.length || (rows.length === 1 && rows[0].length === 1)) return;
    event.preventDefault();
    const gel = p.gels.find((item) => item.id === gelId)!,
      laneValues = rows.map((row) => row.slice(1)),
      requiredLanes = Math.max(
        gel.lanes,
        ...laneValues.map((values) => values.length),
      );
    if (
      requiredLanes > gel.lanes &&
      !window.confirm(
        `条件名を含む貼り付けには${requiredLanes}レーン必要です。レーン数を増やしますか？`,
      )
    )
      return;
    conditionCheckpoint();
    patch((project) => {
      const target = project.gels.find((item) => item.id === gelId)!;
      pasteGrid(target, rowIndex, 0, laneValues, (index, laneCount) => ({
        id: uid(),
        name: `Condition ${index + 1}`,
        values: Array(laneCount).fill(""),
        visible: true,
      }));
      rows.forEach((values, offset) => {
        target.conditions[rowIndex + offset].name = values[0] || "";
      });
      return project;
    });
  }
  function fillConditionToRight(gelId: string, rowId: string) {
    const selection = conditionCellSelection;
    if (!selection || selection.gelId !== gelId || selection.rowId !== rowId) return;
    conditionCheckpoint();
    patch((project) => {
      const gel = project.gels.find((item) => item.id === gelId)!,
        row = gel.conditions.find((item) => item.id === rowId)!;
      const start = Math.min(selection.start, selection.end),
        end = Math.max(selection.start, selection.end);
      fillRowToRight(row, gel.lanes, start, end);
      return project;
    });
  }
  function mergeIdenticalConditionCells(gelId: string, rowId: string) {
    const selection = conditionCellSelection;
    if (!selection || selection.gelId !== gelId || selection.rowId !== rowId) {
      setNotice("同一値をまとめる範囲を選択してください");
      return;
    }
    conditionCheckpoint();
    patch((project) => {
      const gel = project.gels.find((item) => item.id === gelId)!,
        row = gel.conditions.find((item) => item.id === rowId)!,
        values = Array.from({ length: gel.lanes }, (_, lane) => {
          const group = row.groups?.find(
            (item) => lane >= item.start && lane < item.start + item.span,
          );
          return group ? group.label : row.values[lane] || "";
        }),
        start = Math.min(selection.start, selection.end),
        end = Math.max(selection.start, selection.end),
        groups: NonNullable<Condition["groups"]> = [];
      let lane = 0;
      while (lane < gel.lanes) {
        let span = 1;
        if (lane >= start && lane <= end && values[lane].trim())
          while (
            lane + span <= end &&
            values[lane + span] === values[lane]
          )
            span++;
        groups.push({ label: values[lane], start: lane, span });
        lane += span;
      }
      row.groups = groups;
      row.lineBelow = true;
      return project;
    });
  }
  function toggleSelectedGroupLines(gelId: string, rowId: string) {
    const selection = conditionCellSelection;
    if (!selection || selection.gelId !== gelId || selection.rowId !== rowId)
      return;
    conditionCheckpoint();
    patch((project) => {
      const row = project.gels
        .find((item) => item.id === gelId)!
        .conditions.find((item) => item.id === rowId)!;
      if (!row.groups?.length) return project;
      const selectedGroups = row.groups.filter(
          (group) =>
            group.start <= selection.end &&
            group.start + group.span - 1 >= selection.start,
        ),
        shouldShow = selectedGroups.some((group) => group.showLine === false);
      selectedGroups.forEach((group) => (group.showLine = shouldShow));
      return project;
    });
  }
  function copyConditionSelection(
    event: ClipboardEvent<HTMLDivElement>,
    gel: Gel,
  ) {
    const target = event.target as HTMLInputElement;
    if (
      target instanceof HTMLInputElement &&
      (target.selectionEnd || 0) > (target.selectionStart || 0)
    )
      return;
    const selection = conditionCellSelection;
    if (!selection || selection.gelId !== gel.id) return;
    const row = gel.conditions.find((item) => item.id === selection.rowId);
    if (!row) return;
    const start = Math.min(selection.start, selection.end),
      end = Math.max(selection.start, selection.end);
    if (
      start === end &&
      (selection.anchorRowId || selection.rowId) ===
        (selection.endRowId || selection.rowId)
    )
      return;
    event.preventDefault();
    event.clipboardData.setData(
      "text/plain",
      conditionSelectionText(gel, selection),
    );
  }
  function conditionSelectionText(
    gel: Gel,
    selection: NonNullable<typeof conditionCellSelection>,
  ) {
    const start = Math.min(selection.start, selection.end),
      end = Math.max(selection.start, selection.end),
      anchor = gel.conditions.findIndex(
        (item) => item.id === (selection.anchorRowId || selection.rowId),
      ),
      endRow = gel.conditions.findIndex(
        (item) => item.id === (selection.endRowId || selection.rowId),
      );
    return gel.conditions
      .slice(Math.min(anchor, endRow), Math.max(anchor, endRow) + 1)
      .map((row) =>
        Array.from({ length: end - start + 1 }, (_, offset) => {
          const lane = start + offset,
            group = row.groups?.find(
              (item) => lane >= item.start && lane < item.start + item.span,
            );
          return group
            ? lane === group.start
              ? group.label
              : ""
            : row.values[lane] || "";
        }).join("\t"),
      )
      .join("\n");
  }
  async function copyConditionToolbar() {
    const selection = conditionCellSelection,
      gel = p.gels.find((item) => item.id === selection?.gelId),
      row = gel?.conditions.find((item) => item.id === selection?.rowId);
    if (!selection || !gel || !row) {
      setNotice("コピーするセル範囲を選択してください");
      return;
    }
    try {
      await navigator.clipboard.writeText(conditionSelectionText(gel, selection));
      setNotice("選択セルをコピーしました");
    } catch {
      setNotice("ブラウザのクリップボード権限がないため、⌘/Ctrl+Cを使用してください");
    }
  }
  async function pasteConditionToolbar() {
    const selection = conditionCellSelection,
      gel = p.gels.find((item) => item.id === selection?.gelId),
      rowIndex = gel?.conditions.findIndex((item) => item.id === selection?.rowId) ?? -1;
    if (!selection || !gel || rowIndex < 0) {
      setNotice("貼り付け開始セルを選択してください");
      return;
    }
    let clipboardText = "";
    try {
      clipboardText = await navigator.clipboard.readText();
    } catch {
      setNotice("ブラウザのクリップボード権限がないため、⌘/Ctrl+Vを使用してください");
      return;
    }
    const rows = parseClipboardGrid(clipboardText);
    if (!rows.length) return;
    const required = selection.start + Math.max(...rows.map((row) => row.length));
    if (
      required > gel.lanes &&
      !window.confirm(`貼り付けには${required}レーン必要です。レーン数を増やしますか？`)
    )
      return;
    conditionCheckpoint();
    patch((project) => {
      pasteGrid(
        project.gels.find((item) => item.id === gel.id)!,
        rowIndex,
        selection.start,
        rows,
        (index, laneCount) => ({
          id: uid(),
          name: `Condition ${index + 1}`,
          values: Array(laneCount).fill(""),
          visible: true,
        }),
      );
      return project;
    });
  }
  function addCondition(gelId: string) {
    conditionCheckpoint();
    patch((x) => {
      const g = x.gels.find((v) => v.id === gelId)!;
      g.conditions.push({
        id: uid(),
        name: "Condition",
        values: Array(g.lanes).fill(""),
        visible: true,
      });
      return x;
    });
  }
  function selectConditionCell(
    gelId: string,
    rowId: string,
    start: number,
    end: number,
    extend: boolean,
  ) {
    setConditionCellSelection((current) => {
      if (
        extend &&
        current &&
        current.gelId === gelId
      )
        return {
          ...current,
          endRowId: rowId,
          start: Math.min(current.start, start),
          end: Math.max(current.end, end),
        };
      return {
        gelId,
        rowId,
        anchorRowId: rowId,
        endRowId: rowId,
        start,
        end,
      };
    });
  }
  function extendConditionSelection(
    gelId: string,
    rowId: string,
    start: number,
    end: number,
  ) {
    setConditionCellSelection((current) =>
      current?.gelId === gelId
        ? {
            ...current,
            endRowId: rowId,
            start: Math.min(current.start, start),
            end: Math.max(current.end, end),
          }
        : current,
    );
  }
  function moveConditionCell(
    event: ReactKeyboardEvent<HTMLInputElement>,
    gel: Gel,
    rowIndex: number,
    lane: number,
    span: number,
  ) {
    if (event.key === "Escape") {
      event.currentTarget.blur();
      return;
    }
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "Tab"].includes(
        event.key,
      )
    )
      return;
    event.preventDefault();
    const target = nextGridCell(
        gel,
        { rowIndex, start: lane, span },
        event.key as
          | "ArrowLeft"
          | "ArrowRight"
          | "ArrowUp"
          | "ArrowDown"
          | "Enter"
          | "Tab",
        event.shiftKey,
      ),
      nextRowId = gel.conditions[target.rowIndex]?.id;
    if (!nextRowId) return;
    selectConditionCell(
      gel.id,
      nextRowId,
      target.start,
      target.start + target.span - 1,
      false,
    );
    queueMicrotask(() => {
      const next = document.querySelector<HTMLInputElement>(
        `[data-condition-gel="${gel.id}"][data-condition-row="${nextRowId}"][data-condition-lane="${target.start}"]`,
      );
      next?.focus();
      next?.select();
    });
  }
  function mergeConditionCells(gelId: string, rowId: string) {
    const selection = conditionCellSelection;
    if (
      !selection ||
      selection.gelId !== gelId ||
      selection.rowId !== rowId ||
      (selection.anchorRowId || selection.rowId) !==
        (selection.endRowId || selection.rowId) ||
      selection.end <= selection.start
    ) {
      setNotice("同じ行で2セル以上を選択してください");
      return;
    }
    conditionCheckpoint();
    patch((project) => {
      const gel = project.gels.find((item) => item.id === gelId)!,
        row = gel.conditions.find((item) => item.id === rowId)!,
        source =
          row.groups?.length
            ? [...row.groups]
            : row.values.map((label, start) => ({ label, start, span: 1 })),
        start = Math.min(selection.start, selection.end),
        end = Math.max(selection.start, selection.end),
        selected = source.filter(
          (group) => group.start <= end && group.start + group.span - 1 >= start,
        ),
        mergedStart = Math.min(start, ...selected.map((group) => group.start)),
        mergedEnd = Math.max(
          end,
          ...selected.map((group) => group.start + group.span - 1),
        ),
        label =
          selected
            .sort((a, b) => a.start - b.start)
            .map((group) => group.label.trim())
            .find(Boolean) || "";
      row.groups = source
        .filter(
          (group) =>
            group.start > mergedEnd ||
            group.start + group.span - 1 < mergedStart,
        )
        .concat({
          label,
          start: mergedStart,
          span: mergedEnd - mergedStart + 1,
        })
        .sort((a, b) => a.start - b.start);
      row.lineBelow = true;
      return project;
    });
    setConditionCellSelection({
      gelId,
      rowId,
      start: selection.start,
      end: selection.end,
    });
  }
  function unmergeConditionCells(gelId: string, rowId: string) {
    const selection = conditionCellSelection;
    if (
      !selection ||
      selection.gelId !== gelId ||
      selection.rowId !== rowId ||
      (selection.anchorRowId || selection.rowId) !==
        (selection.endRowId || selection.rowId)
    ) {
      setNotice("解除する結合セルを選択してください");
      return;
    }
    conditionCheckpoint();
    patch((project) => {
      const row = project.gels
        .find((item) => item.id === gelId)!
        .conditions.find((item) => item.id === rowId)!;
      if (!row.groups?.length) return project;
      row.groups = row.groups.flatMap((group) => {
        const groupEnd = group.start + group.span - 1,
          selected =
            group.start <= selection.end && groupEnd >= selection.start;
        if (!selected || group.span === 1) return [group];
        return Array.from({ length: group.span }, (_, offset) => ({
          label: offset === 0 ? group.label : "",
          start: group.start + offset,
          span: 1,
        }));
      });
      if (row.groups.every((group) => group.span === 1)) {
        row.values = Array.from({ length: row.groups.length }, (_, lane) =>
          row.groups!.find((group) => group.start === lane)?.label || "",
        );
        row.groups = undefined;
        row.lineBelow = false;
      }
      return project;
    });
  }
  function renderConditionSpreadsheet(gel: Gel) {
    const selectedRow =
        conditionCellSelection?.gelId === gel.id
          ? gel.conditions.find(
              (row) => row.id === conditionCellSelection.rowId,
            )
          : undefined,
      selectedHasMerged = Boolean(
        selectedRow?.groups?.some((group) => group.span > 1),
      ),
      sheetLabelWidth = 150,
      sheetControlWidth = 82,
      sheetLaneWidth = 46,
      sheetMinWidth = sheetLabelWidth + sheetControlWidth + gel.lanes * sheetLaneWidth;
    return (
      <div
        className="conditionSpreadsheet"
        onCopy={(event) => copyConditionSelection(event, gel)}
      >
        <div className="conditionSheetGrid" style={{ minWidth: sheetMinWidth }}>
          {gel.lanes > 0 && (
          <div
            className="laneGridHeader"
            style={{
              gridTemplateColumns: `${sheetLabelWidth}px repeat(${gel.lanes}, minmax(${sheetLaneWidth}px, 1fr)) ${sheetControlWidth}px`,
            }}
          >
            <b className="sheetCorner">条件名</b>
            {Array.from({ length: gel.lanes }, (_, lane) => (
              <b key={lane}>{lane + 1}</b>
            ))}
            <b className="sheetActions">操作</b>
          </div>
        )}
        {gel.conditions.map((row, rowIndex) => (
          <section
            className="condition"
            key={row.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const sourceId = event.dataTransfer.getData(
                "text/x-blotcanvas-condition-row",
              );
              if (!sourceId || sourceId === row.id) return;
              conditionCheckpoint();
              patch((project) => {
                const conditions = project.gels.find(
                    (item) => item.id === gel.id,
                  )!.conditions,
                  from = conditions.findIndex((item) => item.id === sourceId),
                  to = conditions.findIndex((item) => item.id === row.id);
                if (from < 0 || to < 0) return project;
                const [moved] = conditions.splice(from, 1);
                conditions.splice(to, 0, moved);
                return project;
              });
            }}
          >
            <div className="conditionHeader">
              <span
                className="rowDragHandle"
                title="ドラッグして行を並べ替え"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData(
                    "text/x-blotcanvas-condition-row",
                    row.id,
                  );
                }}
              >
                ⠿
              </span>
              <input
                className="condName"
                aria-label="条件名"
                value={row.name}
                onFocus={conditionCheckpoint}
                onPaste={(event) =>
                  pasteConditionRowsWithNames(event, gel.id, rowIndex)
                }
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  updateConditionRow(gel.id, row.id, (target) => {
                    target.name = value;
                  });
                }}
              />
              <button
                type="button"
                className="danger rowDeleteButton"
                title="この条件行を削除"
                aria-label={`${row.name || "無題の条件行"}を削除`}
                onClick={() => {
                  conditionCheckpoint();
                  patch((project) => {
                    const target = project.gels.find(
                      (item) => item.id === gel.id,
                    )!;
                    target.conditions = target.conditions.filter(
                      (item) => item.id !== row.id,
                    );
                    return project;
                  });
                }}
              >
                ×
              </button>
            </div>
            <div
              className="cells spreadsheetCells"
              style={{
                gridTemplateColumns: `repeat(${gel.lanes}, minmax(${sheetLaneWidth}px, 1fr))`,
              }}
            >
              {(row.groups?.length
                ? [...row.groups].sort((a, b) => a.start - b.start)
                : row.values.map((label, start) => ({
                    label,
                    start,
                    span: 1,
                  }))
              ).map((cell) => {
                const selected =
                  conditionCellSelection?.gelId === gel.id &&
                  (() => {
                    const anchor = gel.conditions.findIndex(
                        (item) =>
                          item.id ===
                          (conditionCellSelection.anchorRowId ||
                            conditionCellSelection.rowId),
                      ),
                      endRow = gel.conditions.findIndex(
                        (item) =>
                          item.id ===
                          (conditionCellSelection.endRowId ||
                            conditionCellSelection.rowId),
                      );
                    return (
                      rowIndex >= Math.min(anchor, endRow) &&
                      rowIndex <= Math.max(anchor, endRow)
                    );
                  })() &&
                  cell.start <= conditionCellSelection.end &&
                  cell.start + cell.span - 1 >= conditionCellSelection.start;
                return (
                  <label
                    className={`spreadsheetCell ${selected ? "selected" : ""} ${cell.span > 1 ? "merged" : ""}`}
                    style={{
                      gridColumn: `${cell.start + 1} / span ${cell.span}`,
                    }}
                    key={`${cell.start}-${cell.span}`}
                  >
                    <input
                      data-condition-gel={gel.id}
                      data-condition-row={row.id}
                      data-condition-lane={cell.start}
                      aria-label={
                        cell.span > 1
                          ? `${row.name || "条件"} Lane ${cell.start + 1}–${cell.start + cell.span}`
                          : `${row.name || "条件"} Lane ${cell.start + 1}`
                      }
                      value={cell.label}
                      placeholder={`${cell.start + 1}`}
                      onFocus={conditionCheckpoint}
                      onPaste={(event) =>
                        pasteConditionCells(
                          event,
                          gel.id,
                          rowIndex,
                          cell.start,
                        )
                      }
                      onPointerDown={(event) =>
                        selectConditionCell(
                          gel.id,
                          row.id,
                          cell.start,
                          cell.start + cell.span - 1,
                          event.shiftKey,
                        )
                      }
                      onPointerEnter={(event) => {
                        if (event.buttons === 1)
                          extendConditionSelection(
                            gel.id,
                            row.id,
                            cell.start,
                            cell.start + cell.span - 1,
                          );
                      }}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        updateConditionRow(gel.id, row.id, (target) => {
                          if (target.groups?.length) {
                            const group = target.groups.find(
                              (item) =>
                                item.start === cell.start &&
                                item.span === cell.span,
                            );
                            if (group) group.label = value;
                          } else target.values[cell.start] = value;
                        });
                      }}
                      onKeyDown={(event) =>
                        moveConditionCell(
                          event,
                          gel,
                          rowIndex,
                          cell.start,
                          cell.span,
                        )
                      }
                    />
                  </label>
                );
              })}
            </div>
            <div className="conditionOrderButtons" aria-label="条件行の操作">
                <button
                  type="button"
                  title="1つ上へ移動"
                  aria-label="1つ上へ移動"
                  disabled={rowIndex === 0}
                  onClick={() => {
                    conditionCheckpoint();
                    patch((project) => {
                      const conditions = project.gels.find(
                        (item) => item.id === gel.id,
                      )!.conditions;
                      [conditions[rowIndex - 1], conditions[rowIndex]] = [
                        conditions[rowIndex],
                        conditions[rowIndex - 1],
                      ];
                      return project;
                    })
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  title="1つ下へ移動"
                  aria-label="1つ下へ移動"
                  disabled={rowIndex === gel.conditions.length - 1}
                  onClick={() => {
                    conditionCheckpoint();
                    patch((project) => {
                      const conditions = project.gels.find(
                        (item) => item.id === gel.id,
                      )!.conditions;
                      [conditions[rowIndex], conditions[rowIndex + 1]] = [
                        conditions[rowIndex + 1],
                        conditions[rowIndex],
                      ];
                      return project;
                    })
                  }}
                >
                  ↓
                </button>
                <label
                  className="conditionVisible"
                  title={row.visible ? "Figureに表示中" : "Figureでは非表示"}
                >
                  <input
                    type="checkbox"
                    checked={row.visible}
                    onChange={(event) =>
                      patch((project) => {
                        project.gels
                          .find((item) => item.id === gel.id)!
                          .conditions.find(
                            (item) => item.id === row.id,
                          )!.visible = event.target.checked;
                        return project;
                      })
                    }
                  />
                  <span className="srOnly">Figureに表示</span>
                </label>
              </div>
          </section>
        ))}
        </div>
        <div className="spreadsheetToolbar sheetToolbar">
          <span>
            {selectedRow
              ? `選択中：${selectedRow.name || "無題の条件行"}`
              : "セルをクリック、Shift＋クリックで範囲選択"}
          </span>
          <button
            type="button"
            disabled={!selectedRow}
            onClick={() => selectedRow && mergeConditionCells(gel.id, selectedRow.id)}
          >
            セル結合
          </button>
          <button
            type="button"
            disabled={!selectedRow}
            onClick={() => selectedRow && unmergeConditionCells(gel.id, selectedRow.id)}
          >
            結合解除
          </button>
          <button
            type="button"
            disabled={!selectedRow}
            title="選択範囲の並びを右端まで繰り返します"
            onClick={() => selectedRow && fillConditionToRight(gel.id, selectedRow.id)}
          >
            右へオートフィル
          </button>
          <button
            type="button"
            disabled={!selectedRow}
            onClick={() =>
              selectedRow && mergeIdenticalConditionCells(gel.id, selectedRow.id)
            }
          >
            同一値を結合
          </button>
          {selectedHasMerged && (
            <button
              type="button"
              onClick={() =>
                selectedRow && toggleSelectedGroupLines(gel.id, selectedRow.id)
              }
            >
              group線 切替
            </button>
          )}
          {selectedHasMerged && selectedRow && (
            <label className="mini lineToggle">
              <input
                type="checkbox"
                checked={Boolean(selectedRow.lineBelow)}
                onChange={(event) =>
                  patch((project) => {
                    project.gels
                      .find((item) => item.id === gel.id)!
                      .conditions.find(
                        (item) => item.id === selectedRow.id,
                      )!.lineBelow = event.target.checked;
                    return project;
                  })
                }
              />
              区切り線
            </label>
          )}
        </div>
        <button
          type="button"
          className="addConditionRowButton"
          onClick={() => addCondition(gel.id)}
        >
          ＋ 条件行を追加
        </button>
      </div>
    );
  }
  function copyGelConditions(sourceGelId: string, targetGelId: string) {
    conditionCheckpoint();
    patch((project) => {
      const source = project.gels.find((gel) => gel.id === sourceGelId),
        target = project.gels.find((gel) => gel.id === targetGelId);
      if (!source || !target) return project;
      target.lanes = source.lanes;
      target.laneCenter = source.laneCenter;
      target.laneSpan = source.laneSpan;
      target.conditions = source.conditions.map((row) => ({
        ...structuredClone(row),
        id: uid(),
      }));
      return project;
    });
    setNotice("Gel 1の条件表をコピーしました。Gel 2側で個別に修正できます");
  }
  function copyGelConditionsToAll(sourceGelId: string) {
    conditionCheckpoint();
    patch((project) => {
      const source = project.gels.find((gel) => gel.id === sourceGelId);
      if (!source) return project;
      project.gels
        .filter((gel) => gel.id !== sourceGelId)
        .forEach((target) => {
          target.lanes = source.lanes;
          target.laneCenter = source.laneCenter;
          target.laneSpan = source.laneSpan;
          target.conditions = source.conditions.map((row) => ({
            ...structuredClone(row),
            id: uid(),
          }));
        });
      return project;
    });
    setNotice("条件表を他のすべてのGelへコピーしました");
  }
  function applyPairTemplate(gelId: string) {
    const input = pairTemplate[gelId] || {
        expressions: "none, WT",
        pair: "−, ＋",
      },
      expressions = input.expressions
        .split(/[,，、]+/)
        .map((v) => v.trim())
        .filter(Boolean),
      pair = input.pair
        .split(/[,，、]+/)
        .map((v) => v.trim())
        .filter(Boolean);
    if (!expressions.length || pair.length !== 2) {
      setNotice("発現条件を1つ以上、ペア条件を2つ入力してください");
      return;
    }
    patch((project) => {
      const gel = project.gels.find((g) => g.id === gelId)!;
      gel.lanes = expressions.length * 2;
      gel.conditions = [
        {
          id: uid(),
          name:
            input.groupLabel === undefined ? "Group" : input.groupLabel.trim(),
          values: Array(expressions.length * 2).fill(""),
          visible: true,
          lineBelow: true,
          groups: expressions.map((label, index) => ({
            label,
            start: index * 2,
            span: 2,
          })),
        },
        {
          id: uid(),
          name:
            input.pairLabel === undefined
              ? "Condition"
              : input.pairLabel.trim(),
          values: expressions.flatMap(() => pair),
          visible: true,
        },
      ];
      return project;
    });
    setNotice("繰り返し条件の表を作成しました。下の表で自由に修正できます");
  }
  function applySimpleTemplate(gelId: string) {
    const input = simpleTemplate[gelId] || {
        label: "Sample",
        values: "Control, Sample 1, Sample 2, Sample 3",
      },
      values = input.values
        .split(/[,，、]+/)
        .map((value) => value.trim())
        .filter(Boolean);
    if (!values.length) {
      setNotice("レーンラベルを1つ以上入力してください");
      return;
    }
    patch((project) => {
      const gel = project.gels.find((item) => item.id === gelId)!;
      gel.lanes = values.length;
      gel.conditions = [
        {
          id: uid(),
          name: input.label.trim(),
          values,
          visible: true,
        },
      ];
      return project;
    });
    setNotice("各レーンへ個別ラベルを配置しました。下の表で自由に修正できます");
  }
  function applySirnaTemplate(gelId: string) {
    const input = sirnaTemplate[gelId] || {
        target: "Gene A, Gene B",
        negative: "NC",
        sequences: "#1, #2, #3",
      },
      targets = input.target
        .split(/[,，、]+/)
        .map((v) => v.trim())
        .filter(Boolean),
      sequences = input.sequences
        .split(/[,，、]+/)
        .map((v) => v.trim())
        .filter(Boolean);
    if (!targets.length || !input.negative.trim() || !sequences.length) {
      setNotice("標的名を1つ以上、ネガコン名、配列名を入力してください");
      return;
    }
    patch((project) => {
      const gel = project.gels.find((g) => g.id === gelId)!;
      gel.lanes = 1 + targets.length * sequences.length;
      gel.conditions = [
        {
          id: uid(),
          name: "siRNA target",
          values: Array(gel.lanes).fill(""),
          visible: true,
          lineBelow: true,
          groups: targets.map((label, index) => ({
            label,
            start: 1 + index * sequences.length,
            span: sequences.length,
          })),
        },
        {
          id: uid(),
          name: "Sequence",
          values: [
            input.negative.trim(),
            ...targets.flatMap(() => sequences),
          ],
          visible: true,
        },
      ];
      return project;
    });
    setNotice("階層条件の表を作成しました。下の表で自由に修正できます");
  }
  function addPlusMinusCondition(gelId: string) {
    patch((project) => {
      const gel = project.gels.find((g) => g.id === gelId)!;
      gel.conditions.push({
        id: uid(),
        name:
          plusMinusName[gelId] === undefined
            ? "Treatment"
            : plusMinusName[gelId].trim(),
        values: Array.from({ length: gel.lanes }, (_, i) =>
          i % 2 === 0 ? "−" : "+",
        ),
        visible: true,
      });
      return project;
    });
    setNotice("±条件行を追加しました。各セルは自由に修正できます");
  }
  function move(id: string, d: number) {
    patch((x) => {
      const regions = x.captures.flatMap((capture) => capture.regions),
        selected = regions.find((region) => region.id === id);
      if (!selected) return x;
      const canonical = canonicalRegionOrder(x.order, regions),
        localIds = canonical.filter(
          (regionId) =>
            regions.find((region) => region.id === regionId)?.gelId ===
            selected.gelId,
        ),
        from = localIds.indexOf(id),
        to = from + d;
      if (to < 0 || to >= localIds.length) return x;
      x.order = reorderRegionWithinGel(
        canonical,
        regions,
        id,
        localIds[to],
        x.syncGelOrder,
        x.gels.map((gel) => gel.id),
      );
      return x;
    });
  }
  function reorderRegion(movedId: string, targetId: string) {
    patch((project) => {
      const regions = project.captures.flatMap((capture) => capture.regions);
      project.order = reorderRegionWithinGel(
        project.order,
        regions,
        movedId,
        targetId,
        project.syncGelOrder,
        project.gels.map((gel) => gel.id),
      );
      return project;
    });
  }
  function regionProcessingStyle(c: Capture, r: Region) {
    const a = r.adjustment;
    return {
      transform: `rotate(${r.rotation ?? c.rotation}deg)`,
      filter: `brightness(${a?.brightness ?? c.brightness}%) contrast(${a?.contrast ?? c.contrast}%) ${a?.preview || c.clPreview ? "" : (a?.invert ?? c.invert) ? "invert(1)" : ""}`,
    };
  }
  async function cropData(c: Capture, r: Region) {
    const src = c.cl || c.merge;
    if (!src) return "";
    const a = r.adjustment,
      imageData = a?.preview || c.clPreview || src.data,
      im = await new Promise<HTMLImageElement>((ok, no) => {
        const z = new Image();
        z.onload = () => ok(z);
        z.onerror = no;
        z.src = imageData;
      });
    const rot = document.createElement("canvas");
    rot.width = src.width;
    rot.height = src.height;
    const g = rot.getContext("2d")!;
    g.translate(src.width / 2, src.height / 2);
    g.rotate(((r.rotation ?? c.rotation) * Math.PI) / 180);
    g.filter = `brightness(${a?.brightness ?? c.brightness}%) contrast(${a?.contrast ?? c.contrast}%) ${a?.preview || c.clPreview ? "" : (a?.invert ?? c.invert) ? "invert(1)" : ""}`;
    g.drawImage(im, -src.width / 2, -src.height / 2);
    const sx = (src.width * (r.x ?? p.cropX)) / 100,
      sy = (src.height * r.y) / 100,
      sw = (src.width * gelWidth(r.gelId)) / 100,
      sh = (src.height * r.h) / 100;
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(sw));
    out.height = Math.max(1, Math.round(sh));
    out
      .getContext("2d")!
      .drawImage(rot, sx, sy, sw, sh, 0, 0, out.width, out.height);
    return out.toDataURL("image/png");
  }
  async function rawCropCanvas(c: Capture, r: Region) {
    const src = c.cl || c.merge;
    if (!src) return null;
    const im = await new Promise<HTMLImageElement>((ok, no) => {
        const image = new Image();
        image.onload = () => ok(image);
        image.onerror = no;
        image.src = src.data;
      }),
      rotated = document.createElement("canvas");
    rotated.width = src.width;
    rotated.height = src.height;
    const context = rotated.getContext("2d")!;
    context.translate(src.width / 2, src.height / 2);
    context.rotate(((r.rotation ?? c.rotation) * Math.PI) / 180);
    context.drawImage(im, -src.width / 2, -src.height / 2);
    const sx = (src.width * (r.x ?? p.cropX)) / 100,
      sy = (src.height * r.y) / 100,
      sw = (src.width * gelWidth(r.gelId)) / 100,
      sh = (src.height * r.h) / 100,
      out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(sw));
    out.height = Math.max(1, Math.round(sh));
    out.getContext("2d")!.drawImage(rotated, sx, sy, sw, sh, 0, 0, out.width, out.height);
    return out;
  }
  async function quantFullPreview(c: Capture, r: Region) {
    const src = c.cl || c.merge;
    if (!src) return "";
    const adjustment = r.adjustment,
      invert = adjustment?.invert ?? c.invert;
    let displayData = adjustment?.preview || src.data;
    if (
      !adjustment?.preview &&
      adjustment?.mode === "minmax" &&
      adjustment.min !== undefined &&
      adjustment.max !== undefined
    ) {
      try {
        displayData = await rawAdjustedData(src, {
          min: adjustment.min,
          max: adjustment.max,
          bitDepth: adjustment.bitDepth || src.bitsPerSample || 8,
          invert,
        });
      } catch {}
    } else if (!adjustment?.preview) {
      try {
        displayData = (await autoLevels(src, invert)).preview;
      } catch {}
    }
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = reject;
        element.src = displayData;
      }),
      canvas = document.createElement("canvas");
    canvas.width = src.width;
    canvas.height = src.height;
    const context = canvas.getContext("2d")!;
    context.translate(src.width / 2, src.height / 2);
    context.rotate(((r.rotation ?? c.rotation) * Math.PI) / 180);
    context.filter = `brightness(${adjustment?.brightness ?? c.brightness}%) contrast(${adjustment?.contrast ?? c.contrast}%)`;
    context.drawImage(image, -src.width / 2, -src.height / 2);
    return canvas.toDataURL("image/png");
  }
  function defaultQuantRois(r: Region) {
    const gel = p.gels.find((item) => item.id === r.gelId),
      count = gel?.lanes || 1,
      span = gel?.laneSpan ?? 100,
      center = gel?.laneCenter ?? 50,
      laneStep = span / count,
      regionWidth = gelWidth(r.gelId),
      width = Math.max(1.2, Math.min(16.8, regionWidth * laneStep * 0.00864));
    return Array.from({ length: count }, (_, index) => ({
      id: uid(),
      lane: index + 1,
      x: Math.max(
        0,
        Math.min(
          100 - width,
          (r.x ?? p.cropX) +
            regionWidth *
              (center / 100 + ((index + 0.5) / count - 0.5) * (span / 100)) -
            width / 2,
        ),
      ),
      y: r.y + r.h * 0.41,
      w: width,
      h: Math.max(1.5, r.h * 0.18),
    }));
  }
  function defaultBackgroundRoi(r: Region): QuantRoi {
    const width = Math.max(5, Math.min(18, gelWidth(r.gelId) * 0.18)),
      height = Math.max(3, r.h * 0.25);
    return {
      id: uid(),
      lane: 0,
      x: Math.max(0, Math.min(100 - width, (r.x ?? p.cropX) + gelWidth(r.gelId) - width)),
      y: Math.max(0, Math.min(100 - height, r.y + r.h + 2)),
      w: width,
      h: height,
    };
  }
  async function setQuantTarget(r: Region, enabled: boolean) {
    patch((project) => {
      project.quantification ??= {
        targets: [],
        normalizationRegionIds: {},
        valueMode: "correctedIntegrated",
        nonDetectMode: "nd",
        colors: {},
        graph: {
          type: "bar",
          fontFamily: "Helvetica",
          fontSize: 16,
          width: 700,
          height: 560,
          showValues: false,
          title: "",
          palette: "nature",
          customColors: [...GRAPH_PALETTES.nature],
        },
      };
      const existing = project.quantification.targets.find(
        (target) => target.regionId === r.id,
      );
      if (existing) {
        existing.enabled = enabled;
        existing.backgroundRoi ??= defaultBackgroundRoi(r);
      }
      else
        project.quantification.targets.push({
          regionId: r.id,
          enabled,
          signalMode: "light",
          rois: defaultQuantRois(r),
          backgroundRoi: defaultBackgroundRoi(r),
          measurements: [],
        });
      return project;
    });
    if (enabled) {
      setQuantActiveRegionId(r.id);
      const item = allRegions.find((entry) => entry.r.id === r.id);
      if (item) {
        const preview = await quantFullPreview(item.c, item.r);
        if (preview) setQuantPreviews((old) => ({ ...old, [r.id]: preview }));
      }
    }
  }
  function patchQuantRoi(regionId: string, roiId: string, values: Partial<QuantRoi>) {
    if (quantLaneProfile?.regionId === regionId)
      setQuantLaneProfile(undefined);
    patch((project) => {
      const target = project.quantification?.targets.find(
          (item) => item.regionId === regionId,
        ),
        roi = roiId === "__background__"
          ? target?.backgroundRoi
          : target?.rois.find((item) => item.id === roiId);
      if (roi) {
        Object.assign(roi, values);
        if (target) {
          target.measurements = [];
          target.measuredAt = undefined;
        }
      }
      return project;
    });
  }
  function resetQuantRois(r: Region) {
    if (quantLaneProfile?.regionId === r.id)
      setQuantLaneProfile(undefined);
    patch((project) => {
      const target = project.quantification?.targets.find(
        (item) => item.regionId === r.id,
      );
      if (target) {
        target.rois = defaultQuantRois(r);
        target.backgroundRoi = defaultBackgroundRoi(r);
        target.measurements = [];
        target.measuredAt = undefined;
      }
      return project;
    });
  }
  function quantPointerMove(e: PointerEvent<HTMLDivElement>) {
    const current = quantDrag.current;
    if (!current) return;
    const bounds = e.currentTarget.getBoundingClientRect(),
      x = ((e.clientX - bounds.left) / bounds.width) * 100,
      y = ((e.clientY - bounds.top) / bounds.height) * 100,
      target = p.quantification?.targets.find(
        (item) => item.regionId === current.regionId,
      ),
      roi = current.roiId === "__background__"
        ? target?.backgroundRoi
        : target?.rois.find((item) => item.id === current.roiId);
    if (!roi) return;
    if (current.mode === "move")
      patchQuantRoi(current.regionId, current.roiId, {
        x: Math.max(0, Math.min(100 - roi.w, x - current.offsetX)),
        y: Math.max(0, Math.min(100 - roi.h, y - current.offsetY)),
      });
    else
      patchQuantRoi(current.regionId, current.roiId, {
        w: Math.max(1, Math.min(100 - roi.x, x - roi.x)),
        h: Math.max(2, Math.min(100 - roi.y, y - roi.y)),
      });
  }
  async function measureQuantTarget(regionId: string) {
    const entry = allRegions.find((item) => item.r.id === regionId),
      target = p.quantification?.targets.find((item) => item.regionId === regionId);
    if (!entry || !target) return;
    const source = entry.c.cl || entry.c.merge;
    if (!source) return;
    const raw = await originalGrayPixels(source),
      angle = ((entry.r.rotation ?? entry.c.rotation) * Math.PI) / 180,
      cosine = Math.cos(angle),
      sine = Math.sin(angle),
      gray = (x: number, y: number) => {
        const dx = x + 0.5 - raw.width / 2,
          dy = y + 0.5 - raw.height / 2,
          sourceX = Math.round(cosine * dx + sine * dy + raw.width / 2),
          sourceY = Math.round(-sine * dx + cosine * dy + raw.height / 2);
        if (sourceX < 0 || sourceX >= raw.width || sourceY < 0 || sourceY >= raw.height)
          return undefined;
        return raw.values[sourceY * raw.width + sourceX];
      },
      backgroundRoi = target.backgroundRoi || defaultBackgroundRoi(entry.r),
      bx0 = Math.max(0, Math.floor((backgroundRoi.x / 100) * raw.width)),
      bx1 = Math.min(raw.width, Math.ceil(((backgroundRoi.x + backgroundRoi.w) / 100) * raw.width)),
      by0 = Math.max(0, Math.floor((backgroundRoi.y / 100) * raw.height)),
      by1 = Math.min(raw.height, Math.ceil(((backgroundRoi.y + backgroundRoi.h) / 100) * raw.height));
    let manualBackgroundSum = 0,
      manualBackgroundCount = 0;
    for (let y = by0; y < by1; y++)
      for (let x = bx0; x < bx1; x++) {
        const value = gray(x, y);
        if (value === undefined) continue;
        manualBackgroundSum += value;
        manualBackgroundCount++;
      }
    const manualBackground = manualBackgroundCount
      ? manualBackgroundSum / manualBackgroundCount
      : 0,
      measurements = target.rois.map((roi) => {
        const x0 = Math.max(0, Math.floor((roi.x / 100) * raw.width)),
          x1 = Math.min(raw.width, Math.ceil(((roi.x + roi.w) / 100) * raw.width)),
          y0 = Math.max(0, Math.floor((roi.y / 100) * raw.height)),
          y1 = Math.min(raw.height, Math.ceil(((roi.y + roi.h) / 100) * raw.height));
        let sum = 0,
          count = 0,
          saturated = 0;
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) {
            const value = gray(x, y);
            if (value === undefined) continue;
            sum += value;
            count++;
            if (value <= raw.maximum * 0.001 || value >= raw.maximum * 0.999)
              saturated++;
          }
        const mean = count ? sum / count : 0,
          background = manualBackground,
          netMean = target.signalMode === "light" ? mean - background : background - mean,
          notDetected = netMean <= 0,
          correctedMean = Math.max(0, netMean);
        return {
          lane: roi.lane,
          area: count,
          mean,
          background,
          correctedMean,
          correctedIntegrated: correctedMean * count,
          netMean,
          notDetected,
          saturatedPercent: count ? (saturated / count) * 100 : 0,
          bitDepth: raw.bits,
        };
      });
    patch((project) => {
      const saved = project.quantification?.targets.find(
        (item) => item.regionId === regionId,
      );
      if (saved) {
        saved.measurements = measurements;
        saved.measuredAt = new Date().toISOString();
      }
      return project;
    });
  }
  async function measureAllQuantTargets() {
    setQuantBusy(true);
    try {
      const ids = (p.quantification?.targets || [])
        .filter((target) => target.enabled)
        .map((target) => target.regionId);
      for (const id of ids) await measureQuantTarget(id);
      setNotice(`${ids.length}個のブロットを元画像から測定しました`);
    } finally {
      setQuantBusy(false);
    }
  }
  async function calculateQuantLaneProfile(regionId: string, lane: number) {
    const entry = allRegions.find((item) => item.r.id === regionId),
      target = p.quantification?.targets.find(
        (item) => item.regionId === regionId,
      ),
      roi = target?.rois.find((item) => item.lane === lane),
      source = entry?.c.cl || entry?.c.merge;
    if (!entry || !target || !roi || !source) return;
    setQuantProfileBusy(true);
    try {
      const raw = await originalGrayPixels(source),
        angle = ((entry.r.rotation ?? entry.c.rotation) * Math.PI) / 180,
        cosine = Math.cos(angle),
        sine = Math.sin(angle),
        gray = (x: number, y: number) => {
          const dx = x + 0.5 - raw.width / 2,
            dy = y + 0.5 - raw.height / 2,
            sourceX = Math.round(
              cosine * dx + sine * dy + raw.width / 2,
            ),
            sourceY = Math.round(
              -sine * dx + cosine * dy + raw.height / 2,
            );
          if (
            sourceX < 0 ||
            sourceX >= raw.width ||
            sourceY < 0 ||
            sourceY >= raw.height
          )
            return undefined;
          return raw.values[sourceY * raw.width + sourceX];
        },
        backgroundRoi =
          target.backgroundRoi || defaultBackgroundRoi(entry.r),
        bx0 = Math.max(
          0,
          Math.floor((backgroundRoi.x / 100) * raw.width),
        ),
        bx1 = Math.min(
          raw.width,
          Math.ceil(
            ((backgroundRoi.x + backgroundRoi.w) / 100) * raw.width,
          ),
        ),
        by0 = Math.max(
          0,
          Math.floor((backgroundRoi.y / 100) * raw.height),
        ),
        by1 = Math.min(
          raw.height,
          Math.ceil(
            ((backgroundRoi.y + backgroundRoi.h) / 100) * raw.height,
          ),
        );
      let backgroundSum = 0,
        backgroundCount = 0;
      for (let y = by0; y < by1; y++)
        for (let x = bx0; x < bx1; x++) {
          const value = gray(x, y);
          if (value === undefined) continue;
          backgroundSum += value;
          backgroundCount++;
        }
      const background = backgroundCount
          ? backgroundSum / backgroundCount
          : 0,
        x0 = Math.max(0, Math.floor((roi.x / 100) * raw.width)),
        x1 = Math.min(
          raw.width,
          Math.ceil(((roi.x + roi.w) / 100) * raw.width),
        ),
        y0 = Math.max(0, Math.floor((roi.y / 100) * raw.height)),
        y1 = Math.min(
          raw.height,
          Math.ceil(((roi.y + roi.h) / 100) * raw.height),
        ),
        points: QuantLaneProfile["points"] = [];
      for (let y = y0; y < y1; y++) {
        let rowSum = 0,
          rowCount = 0;
        for (let x = x0; x < x1; x++) {
          const value = gray(x, y);
          if (value === undefined) continue;
          rowSum += value;
          rowCount++;
        }
        if (!rowCount) continue;
        const sourceMean = rowSum / rowCount,
          netIntensity =
            target.signalMode === "light"
              ? sourceMean - background
              : background - sourceMean;
        points.push({
          position: points.length ? ((y - y0) / Math.max(1, y1 - y0 - 1)) * 100 : 0,
          sourceMean,
          netIntensity,
        });
      }
      setQuantLaneProfile({
        regionId,
        lane,
        bitDepth: raw.bits,
        background,
        points,
      });
    } finally {
      setQuantProfileBusy(false);
    }
  }
  function exportQuantLaneProfileCsv() {
    if (!quantLaneProfile) return;
    const entry = allRegions.find(
        (item) => item.r.id === quantLaneProfile.regionId,
      ),
      rows = [
        "Position_percent,Source_mean_intensity,Background,Net_intensity",
        ...quantLaneProfile.points.map((point) =>
          [
            point.position.toFixed(4),
            point.sourceMean.toFixed(6),
            quantLaneProfile.background.toFixed(6),
            point.netIntensity.toFixed(6),
          ].join(","),
        ),
      ],
      safeName = (entry?.r.antibody || "blot").replace(
        /[^a-zA-Z0-9._-]+/g,
        "_",
      );
    save(
      `${safeName}-lane-${quantLaneProfile.lane}-profile.csv`,
      `\uFEFF${rows.join("\n")}`,
      "text/csv;charset=utf-8",
    );
  }
  async function exportQuantRoiEvidence(regionId: string) {
    const entry = allRegions.find((item) => item.r.id === regionId),
      target = p.quantification?.targets.find(
        (item) => item.regionId === regionId,
      ),
      source = entry?.c.cl || entry?.c.merge;
    if (!entry || !target || !source) return;
    const preview =
        quantPreviews[regionId] || (await quantFullPreview(entry.c, entry.r)),
      image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = reject;
        element.src = preview || source.data;
      }),
      canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || source.width;
    canvas.height = image.naturalHeight || source.height;
    const context = canvas.getContext("2d")!,
      scale = Math.max(1, canvas.width / 1200),
      drawRoi = (roi: QuantRoi, color: string, label: string) => {
        const x = (roi.x / 100) * canvas.width,
          y = (roi.y / 100) * canvas.height,
          width = (roi.w / 100) * canvas.width,
          height = (roi.h / 100) * canvas.height;
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = 2.5 * scale;
        context.strokeRect(x, y, width, height);
        context.font = `700 ${Math.max(13, 16 * scale)}px Arial`;
        context.textBaseline = "bottom";
        context.fillText(label, x + 2 * scale, Math.max(16 * scale, y - 3 * scale));
      };
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    target.rois.forEach((roi) => drawRoi(roi, "#008a5a", `${roi.lane}`));
    if (target.backgroundRoi)
      drawRoi(target.backgroundRoi, "#e67817", "BG");
    const safeName = `${entry.c.key}-${entry.r.antibody}`.replace(
      /[^a-zA-Z0-9._-]+/g,
      "_",
    );
    saveBlob(
      `${safeName}-quantification-ROI-evidence.png`,
      await pngCanvasBlobWithDpi(canvas, 300),
    );
    setNotice("定量ROIの証拠保全PNGを保存しました");
  }
  function quantLaneLabel(regionId: string, lane: number) {
    const entry = allRegions.find((item) => item.r.id === regionId),
      gel = p.gels.find((item) => item.id === entry?.r.gelId),
      values = gel?.conditions
        .filter((row) => row.visible)
        .map((row) => row.values[lane - 1])
        .filter(Boolean);
    return values?.length ? values.join(" / ") : `Lane ${lane}`;
  }
  function quantValues(target: QuantTarget) {
    const targetEntry = allRegions.find((item) => item.r.id === target.regionId),
      gelId = targetEntry?.r.gelId || "",
      referenceId =
        p.quantification?.normalizationRegionIds?.[gelId] ||
        p.quantification?.normalizationRegionId ||
        "",
      mode = p.quantification?.valueMode || "correctedIntegrated",
      reference = p.quantification?.targets.find(
        (item) => item.regionId === referenceId,
      );
    return target.measurements.map((measurement) => {
      if (p.quantification?.nonDetectMode === "nd" && measurement.notDetected)
        return Number.NaN;
      const raw = measurement[mode];
      if (!reference || reference.regionId === target.regionId) return raw;
      const denominator = reference.measurements.find(
        (item) => item.lane === measurement.lane,
      );
      if (p.quantification?.nonDetectMode === "nd" && denominator?.notDetected)
        return Number.NaN;
      const denominatorValue = denominator?.[mode];
      return denominatorValue && denominatorValue > 0 ? raw / denominatorValue : Number.NaN;
    });
  }
  function quantReferenceId(target: QuantTarget) {
    const targetEntry = allRegions.find((item) => item.r.id === target.regionId),
      gelId = targetEntry?.r.gelId || "";
    return (
      p.quantification?.normalizationRegionIds?.[gelId] ||
      p.quantification?.normalizationRegionId ||
      ""
    );
  }
  function exportQuantCsv() {
    const targets = (p.quantification?.targets || []).filter(
        (target) => target.enabled && target.measurements.length,
      ),
      quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`,
      rows = [
        [
          "Capture",
          "Gel",
          "Antibody",
          "Region_ID",
          "Source_image",
          "Rotation_degrees",
          "Measured_at",
          "Lane",
          "Condition",
          "ROI_x_percent",
          "ROI_y_percent",
          "ROI_width_percent",
          "ROI_height_percent",
          "Background_ROI_x_percent",
          "Background_ROI_y_percent",
          "Background_ROI_width_percent",
          "Background_ROI_height_percent",
          "Source_bit_depth",
          "Area_px",
          "Mean_intensity",
          "Local_background",
          "Background_corrected_mean",
          "Background_corrected_integrated_density",
          "Saturated_pixels_percent",
          "Detection_status",
          "Normalized_value",
        ].map(quote).join(","),
      ];
    targets.forEach((target) => {
      const entry = allRegions.find((item) => item.r.id === target.regionId),
        normalized = quantValues(target),
        isNormalizationReference = quantReferenceId(target) === target.regionId,
        gel = p.gels.find((item) => item.id === entry?.r.gelId);
      target.measurements.forEach((measurement, index) => {
        const isNd = p.quantification?.nonDetectMode === "nd" && measurement.notDetected,
          roi = target.rois[index],
          backgroundRoi = target.backgroundRoi;
        rows.push(
          [
            entry?.c.key || "",
            gel?.name || "",
            entry?.r.antibody || "",
            target.regionId,
            entry?.c.cl?.name || entry?.c.merge?.name || "",
            entry?.r.rotation ?? entry?.c.rotation ?? 0,
            target.measuredAt || "",
            measurement.lane,
            quantLaneLabel(target.regionId, measurement.lane),
            roi?.x.toFixed(4) || "",
            roi?.y.toFixed(4) || "",
            roi?.w.toFixed(4) || "",
            roi?.h.toFixed(4) || "",
            backgroundRoi?.x.toFixed(4) || "",
            backgroundRoi?.y.toFixed(4) || "",
            backgroundRoi?.w.toFixed(4) || "",
            backgroundRoi?.h.toFixed(4) || "",
            measurement.bitDepth,
            measurement.area,
            measurement.mean.toFixed(6),
            measurement.background.toFixed(6),
            isNd ? "" : measurement.correctedMean.toFixed(6),
            isNd ? "" : measurement.correctedIntegrated.toFixed(6),
            measurement.saturatedPercent.toFixed(4),
            isNd ? "n.d." : "detected",
            isNd || isNormalizationReference || !Number.isFinite(normalized[index])
              ? ""
              : normalized[index].toFixed(6),
          ].map(quote).join(","),
        );
      });
    });
    save("WB-quantification.csv", `\uFEFF${rows.join("\n")}`, "text/csv;charset=utf-8");
  }
  function quantRoiRecordData() {
    const percentAndPixels = (roi: QuantRoi | undefined, width: number, height: number) =>
      roi
        ? {
            percent: { x: roi.x, y: roi.y, width: roi.w, height: roi.h },
            pixels: {
              x: Math.round((roi.x / 100) * width),
              y: Math.round((roi.y / 100) * height),
              width: Math.round((roi.w / 100) * width),
              height: Math.round((roi.h / 100) * height),
            },
          }
        : null;
    return JSON.stringify(
      {
        type: "BlotCanvasQuantificationRoiRecord",
        version: 1,
        exportedAt: new Date().toISOString(),
        projectName: p.name,
        coordinateSystem:
          "Percent coordinates are relative to the full source signal image after the recorded rotation. Pixel coordinates use the source image dimensions.",
        measurementPolicy:
          "Display adjustments are used only for visualization. Measurements use original grayscale source pixels.",
        targets: (p.quantification?.targets || [])
          .filter((target) => target.enabled)
          .map((target) => {
            const entry = allRegions.find((item) => item.r.id === target.regionId),
              source = entry?.c.cl || entry?.c.merge,
              gel = p.gels.find((item) => item.id === entry?.r.gelId);
            return {
              regionId: target.regionId,
              capture: entry?.c.key || "",
              gel: gel?.name || "",
              antibody: entry?.r.antibody || "",
              sourceImage: source
                ? {
                    name: source.name,
                    relativePath: source.relativePath || "",
                    width: source.width,
                    height: source.height,
                    bitsPerSample: source.bitsPerSample || null,
                  }
                : null,
              rotationDegrees: entry?.r.rotation ?? entry?.c.rotation ?? 0,
              signalMode: target.signalMode,
              measuredAt: target.measuredAt || null,
              bandRois: target.rois.map((roi, index) => ({
                lane: roi.lane,
                condition: quantLaneLabel(target.regionId, roi.lane),
                ...percentAndPixels(roi, source?.width || 0, source?.height || 0),
                measurement: target.measurements[index] || null,
              })),
              backgroundRoi: percentAndPixels(
                target.backgroundRoi,
                source?.width || 0,
                source?.height || 0,
              ),
            };
          }),
      },
      null,
      2,
    );
  }
  function exportQuantRoiRecord() {
    save(
      `WB-${Date.now()}-quantification-ROI-record.json`,
      quantRoiRecordData(),
      "application/json",
    );
  }
  async function renderQuantGraphCanvas(target: QuantTarget) {
    const entry = allRegions.find((item) => item.r.id === target.regionId);
    if (!entry || !p.quantification)
      throw new Error("先に定量測定を実行してください");
    const settings = p.quantification.graph,
      values = quantValues(target),
      normalized = quantReferenceId(target) !== "" && quantReferenceId(target) !== target.regionId,
      scale = 2,
      canvas = document.createElement("canvas"),
      width = settings.width,
      height = settings.height;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d")!;
    context.scale(scale, scale);
    const gel = p.gels.find((item) => item.id === entry.r.gelId),
      visibleConditions = gel?.conditions.filter((row) => row.visible) || [],
      bottomCondition = visibleConditions.at(-1),
      upperConditions = visibleConditions.slice(0, -1),
      left = 105,
      right = 150,
      top = 50,
      bottom = 100 + upperConditions.length * 32,
      plotW = width - left - right,
      plotH = height - top - bottom,
      maxValue = Math.max(...values.filter(Number.isFinite), 1) * 1.12,
      axisScale = graphAxisScale(maxValue),
      font = `${settings.fontSize}px ${settings.fontFamily}`;
    context.strokeStyle = "#111";
    context.fillStyle = "#111";
    context.lineWidth = 1.5;
    context.font = font;
    context.textAlign = "center";
    if (settings.title.trim()) {
      context.font = `600 ${settings.fontSize + 2}px ${settings.fontFamily}`;
      context.fillText(settings.title.trim(), width / 2, 27);
      context.font = font;
    }
    context.beginPath();
    context.moveTo(left, top);
    context.lineTo(left, top + plotH);
    context.lineTo(left + plotW, top + plotH);
    context.stroke();
    for (let tick = 0; tick <= 4; tick++) {
      const value = (maxValue * tick) / 4,
        y = top + plotH - (plotH * tick) / 4;
      context.beginPath();
      context.moveTo(left - 6, y);
      context.lineTo(left, y);
      context.stroke();
      context.textAlign = "right";
      context.fillText(normalized ? value.toFixed(1) : axisScale.exponent ? (value / axisScale.divisor).toFixed(1) : value.toFixed(0), left - 12, y + settings.fontSize * 0.35);
    }
    if (axisScale.exponent) {
      context.textAlign = "left";
      context.fillText(`×10^${axisScale.exponent}`, left + 6, top - 10);
    }
    const gap = plotW / values.length,
      barWidth = Math.min(gap * 0.62, 64),
      keys = Array.from(new Set(values.map((_, index) => bottomCondition?.values[index] || `Lane ${index + 1}`))),
      palette = settings.palette === "custom"
        ? settings.customColors
        : GRAPH_PALETTES[settings.palette];
    values.forEach((value, index) => {
      const x = left + gap * (index + 0.5),
        isNd = !Number.isFinite(value),
        y = isNd ? top + plotH : top + plotH - (value / maxValue) * plotH,
        label = bottomCondition?.values[index] || `Lane ${index + 1}`,
        key = label,
        color = p.quantification!.colors[key] || palette[keys.indexOf(key) % palette.length];
      context.fillStyle = color;
      if (isNd) {
        context.fillStyle = "#555";
        context.fillText("n.d.", x, top + plotH - 8);
      } else if (settings.type === "bar") {
        context.fillRect(x - barWidth / 2, y, barWidth, top + plotH - y);
        context.strokeRect(x - barWidth / 2, y, barWidth, top + plotH - y);
      } else {
        context.beginPath();
        context.arc(x, y, 5, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "#111";
        context.stroke();
      }
      context.fillStyle = "#111";
      context.textAlign = "center";
      if (settings.showValues && !isNd)
        context.fillText(value.toFixed(normalized ? 2 : 0), x, Math.max(top + settings.fontSize, y - 10));
      context.fillText(label, x, top + plotH + settings.fontSize + 9);
    });
    upperConditions.reverse().forEach((condition, rowIndex) => {
      const y = top + plotH + 64 + rowIndex * 32;
      context.textAlign = "right";
      context.fillText(condition.name, left - 12, y);
      if (condition.groups?.length) {
        condition.groups.forEach((group) => {
          if (!group.label.trim()) return;
          const start = Math.max(0, group.start),
            end = Math.min(values.length, start + group.span),
            x1 = left + gap * start + gap * .18,
            x2 = left + gap * end - gap * .18;
          context.textAlign = "center";
          context.fillText(group.label, (x1 + x2) / 2, y);
          if (end - start > 1) {
            context.beginPath();
            context.moveTo(x1, y - settings.fontSize - 5);
            context.lineTo(x2, y - settings.fontSize - 5);
            context.stroke();
          }
        });
        return;
      }
      for (let start = 0; start < values.length;) {
        const label = condition.values[start] || "";
        let end = start + 1;
        while (end < values.length && condition.values[end] === label) end++;
        if (label) {
          const x1 = left + gap * start + gap * .18,
            x2 = left + gap * end - gap * .18;
          context.textAlign = "center";
          context.fillText(label, (x1 + x2) / 2, y);
          if (end - start > 1) {
            context.beginPath();
            context.moveTo(x1, y - settings.fontSize - 5);
            context.lineTo(x2, y - settings.fontSize - 5);
            context.stroke();
          }
        }
        start = end;
      }
    });
    const legendX = left + plotW + 25;
    context.textAlign = "left";
    keys.forEach((key, index) => {
      const y = top + 15 + index * 27;
      context.fillStyle = p.quantification!.colors[key] || palette[index % palette.length];
      context.fillRect(legendX, y - 12, 16, 16);
      context.strokeRect(legendX, y - 12, 16, 16);
      context.fillStyle = "#111";
      context.fillText(key, legendX + 24, y + 1);
    });
    context.save();
    context.translate(25, top + plotH / 2);
    context.rotate(-Math.PI / 2);
    context.textAlign = "center";
    context.font = `${settings.fontSize + 1}px ${settings.fontFamily}`;
    context.fillText(`${entry.r.antibody} ${normalized ? "normalized intensity" : "Intensity"} (a.u.)`, 0, 0);
    context.restore();
    return canvas;
  }
  async function exportQuantGraphPng() {
    const target = p.quantification?.targets.find(
        (item) => item.regionId === quantActiveRegionId && item.measurements.length,
      ) || p.quantification?.targets.find((item) => item.enabled && item.measurements.length),
      entry = allRegions.find((item) => item.r.id === target?.regionId);
    if (!target || !entry || !p.quantification) {
      setNotice("先に定量測定を実行してください");
      return;
    }
    const canvas = await renderQuantGraphCanvas(target);
    const outputDpi = canvas.width / (p.panelWidthMm / 25.4);
    saveBlob(
      `${entry.r.antibody || "WB"}-quantification.png`,
      await pngCanvasBlobWithDpi(canvas, outputDpi),
    );
  }
  async function exportQuantGraphsForAllGels() {
    const activeTarget = p.quantification?.targets.find(
        (item) => item.regionId === quantActiveRegionId && item.measurements.length,
      ) || p.quantification?.targets.find((item) => item.enabled && item.measurements.length),
      activeEntry = allRegions.find((item) => item.r.id === activeTarget?.regionId);
    if (!activeTarget || !activeEntry || !p.quantification) {
      setNotice("先に定量測定を実行してください");
      return;
    }
    const gelOrder = new Map(p.gels.map((gel, index) => [gel.id, index])),
      matching = p.quantification.targets
        .filter((target) => target.measurements.length)
        .map((target) => ({
          target,
          entry: allRegions.find((item) => item.r.id === target.regionId),
        }))
        .filter(
          (
            item,
          ): item is {
            target: QuantTarget;
            entry: (typeof allRegions)[number];
          } =>
            !!item.entry &&
            item.entry.r.antibody === activeEntry.r.antibody,
        )
        .sort(
          (a, b) =>
            (gelOrder.get(a.entry.r.gelId) ?? 999) -
            (gelOrder.get(b.entry.r.gelId) ?? 999),
        );
    if (new Set(matching.map((item) => item.entry.r.gelId)).size < 2) {
      setNotice(
        `「${activeEntry.r.antibody}」は複数ゲルの測定結果がありません`,
      );
      return;
    }
    setNotice(`${activeEntry.r.antibody}の全ゲルグラフを生成しています…`);
    const rendered = await Promise.all(
        matching.map(async (item) => ({
          ...item,
          canvas: await renderQuantGraphCanvas(item.target),
        })),
      ),
      scale = 2,
      header = 42 * scale,
      gap = 18 * scale,
      width = Math.max(...rendered.map((item) => item.canvas.width)),
      height = rendered.reduce(
        (sum, item) => sum + header + item.canvas.height + gap,
        0,
      ),
      combined = document.createElement("canvas");
    combined.width = width;
    combined.height = height;
    const context = combined.getContext("2d")!;
    context.fillStyle = "#111";
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.font = `600 ${Math.max(14, p.quantification.graph.fontSize + 2) * scale}px ${p.quantification.graph.fontFamily}`;
    let y = 0;
    rendered.forEach(({ entry, canvas }) => {
      const gel = p.gels.find((item) => item.id === entry.r.gelId);
      context.fillText(gel?.name || "Gel", 18 * scale, y + 30 * scale);
      y += header;
      context.drawImage(canvas, 0, y);
      y += canvas.height + gap;
    });
    saveBlob(
      `${activeEntry.r.antibody || "WB"}-all-gels-quantification.png`,
      await pngCanvasBlobWithDpi(
        combined,
        combined.width / (p.panelWidthMm / 25.4),
      ),
    );
    setNotice(
      `${activeEntry.r.antibody}のGel 1・Gel 2グラフを1枚にまとめて保存しました`,
    );
  }
  function figureMetrics() {
    const size = Math.max(8, p.fontSize || 20), context = document.createElement("canvas").getContext("2d");
    if (context) context.font = `${size}px ${p.fontFamily || "Helvetica"}`;
    return figureDrawingMetrics(p.gels, allRegions.map(({r}) => r.antibody || r.name), size, p.labelSide,
      value => Math.max(labelWidthEstimate(value, size), context?.measureText(value).width || 0));
  }
  async function figureSvg(externalPrefix = "") {
    const rows = await Promise.all(
        allRegions.map(async (x, index) => ({
          ...x,
          data: await cropData(x.c, x.r),
          assetName: externalPrefix
            ? `${externalPrefix}-figure-image-${String(index + 1).padStart(2, "0")}.png`
            : "",
        })),
      ),
      {maxWidth, labelW, gap, baseW} = figureMetrics(),
      family = esc(p.fontFamily || "Helvetica"),
      size = Math.max(8, p.fontSize || 20),
      top =
        48 +
        Math.max(
          0,
          ...p.gels.map(
            (g) => {
              const artW = (baseW * g.width) / maxWidth;
              return g.conditions
                .filter((row) => row.visible)
                .reduce(
                  (sum, row) =>
                    sum + conditionRowHeight(row, g, artW, size),
                  0,
                );
            },
          ),
        );
    let panelX = 35,
      maxH = top;
    const panels = p.gels
      .map((g) => {
        const artW = (baseW * g.width) / maxWidth,
          items = rows.filter((x) => x.r.gelId === g.id),
          laneX = (lanePosition: number) =>
            labelW +
            artW *
              (g.laneCenter / 100 +
                (lanePosition / g.lanes - 0.5) * (g.laneSpan / 100)),
          groupLineStart = (start: number) => laneX(start + 0.3),
          groupLineEnd = (end: number) => laneX(end - 0.3);
        let y = top;
        const visibleConditions = g.conditions.filter((x) => x.visible),
          rowHeights = visibleConditions.map((row) =>
            conditionRowHeight(row, g, artW, size),
          ),
          conditionTop = conditionRowsStart(top, rowHeights),
          cond = visibleConditions
            .map((row, ri) => {
              const rowStart =
                  conditionTop +
                  rowHeights.slice(0, ri).reduce((sum, value) => sum + value, 0),
                forceRotate = conditionRowNeedsRotation(row, g, artW, size),
                hasWrap = conditionRowHasWrap(row, g, artW, size),
                rowY =
                  rowStart +
                  rowHeights[ri] / 2 +
                  (forceRotate ? 0 : hasWrap ? -size * 0.15 : size * 0.35),
                rowLineY = rowStart + rowHeights[ri] - 4,
                groupSize = Math.max(1, row.groupSize || 1),
                laneWidth = (artW * (g.laneSpan / 100)) / Math.max(1, g.lanes),
                label = `<text x="${p.labelSide === "antibody-right" ? labelW + artW + 14 : labelW - 12}" y="${rowY}" text-anchor="${p.labelSide === "antibody-right" ? "start" : "end"}" class="cond">${esc(row.name)}</text>`;
              if (row.groups?.length)
                return (
                  label +
                  row.groups
                    .map((group) => {
                      const start = Math.max(0, group.start),
                        end = Math.min(g.lanes, start + group.span),
                        line = groupShowsSeparator(row, group)
                          ? `<line x1="${groupLineStart(start)}" y1="${rowLineY}" x2="${groupLineEnd(end)}" y2="${rowLineY}" stroke="#111" stroke-width="1"/>`
                          : "";
                      return `${svgAutoLabel(group.label, laneX((start + end) / 2), rowY, laneWidth * Math.max(1, end - start) - 8, size, forceRotate)}${line}`;
                    })
                    .join("")
                );
              if (groupSize === 1)
                return `${label}${row.values.map((v, i) => svgAutoLabel(v, laneX(i + 0.5), rowY, laneWidth - 8, size, forceRotate)).join("")}`;
              let groups = "";
              for (let i = 0; i < g.lanes; i += groupSize) {
                const end = Math.min(g.lanes, i + groupSize),
                  value = row.values[i] || "";
                groups += svgAutoLabel(value, laneX((i + end) / 2), rowY, laneWidth * (end - i) - 8, size, forceRotate);
                if (row.lineBelow)
                  groups += `<line x1="${groupLineStart(i)}" y1="${rowLineY}" x2="${groupLineEnd(end)}" y2="${rowLineY}" stroke="#111" stroke-width="1"/>`;
              }
              return label + groups;
            })
            .join("");
        let blockY = top;
        const blockLayouts = items.map(({ c, r, data, assetName }) => {
            const src = c.cl || c.merge!,
              h = figureCropHeight(artW, src.width, src.height, g.width, r.h);
            const block = { c, r, data, assetName, y: blockY, h };
            blockY += h + 5;
            return block;
          }),
          markerFontSize = Math.max(9, size - 3),
          markerBottom = figureMarkerBottom(blockY, top, blockLayouts.reduce((count, {r}) => count + figureMarkers(r).filter(marker => marker.on && marker.placed && marker.y >= r.y && marker.y <= r.y + r.h).length, 0), markerFontSize),
          panelMarkerLabels = markerLabelPositions(
            blockLayouts.flatMap(({ r, y: currentY, h }) =>
              figureMarkers(r)
                .filter(
                  (marker) =>
                    marker.on &&
                    marker.placed &&
                    marker.y >= r.y &&
                    marker.y <= r.y + r.h,
                )
                .map((marker) => ({
                  key: `${r.id}:${marker.mw}`,
                  mw: marker.mw,
                  markerY:
                    currentY + ((marker.y - r.y) / r.h) * h,
                })),
            ),
            markerBottom,
            markerFontSize,
            top,
            markerBottom,
          ),
          markerLabelMap = new Map(
            panelMarkerLabels.map((marker) => [marker.key, marker]),
          ),
          blocks = blockLayouts
          .map(({ r, data, assetName, y: currentY, h }) => {
            const bands = figureMarkers(r)
              .filter(
                (marker) =>
                  marker.on &&
                  marker.placed &&
                  marker.y >= r.y &&
                  marker.y <= r.y + r.h,
              )
              .map((marker) => {
                const placed = markerLabelMap.get(`${r.id}:${marker.mw}`)!,
                  by = placed.markerY - currentY,
                  labelY = placed.labelY - currentY,
                  labelMid = labelY - markerFontSize * 0.25,
                  shifted =
                    Math.abs(
                      placed.labelY -
                        (placed.markerY + markerFontSize * 0.35),
                    ) > 1,
                  leader = shifted
                    ? p.labelSide === "antibody-right"
                      ? `<polyline points="${labelW - 12},${by} ${labelW - 12},${labelMid} ${labelW - 19},${labelMid}" fill="none" stroke="#111" stroke-width="1"/>`
                      : `<polyline points="${labelW + artW + 12},${by} ${labelW + artW + 12},${labelMid} ${labelW + artW + 19},${labelMid}" fill="none" stroke="#111" stroke-width="1"/>`
                    : "";
                return p.labelSide === "antibody-right"
                  ? `<line x1="${labelW}" y1="${by}" x2="${labelW - 12}" y2="${by}" stroke="#111" stroke-width="2"/>${leader}<text x="${labelW - 27}" y="${labelY}" text-anchor="middle" class="mw">${marker.mw}</text>`
                  : `<line x1="${labelW + artW}" y1="${by}" x2="${labelW + artW + 12}" y2="${by}" stroke="#111" stroke-width="2"/>${leader}<text x="${labelW + artW + 27}" y="${labelY}" text-anchor="middle" class="mw">${marker.mw}</text>`;
              })
              .join("");
            const antibodyX = p.labelSide === "antibody-right" ? labelW + artW + 14 : labelW - 12,
              antibodyAnchor = p.labelSide === "antibody-right" ? "start" : "end",
              s = `<g id="${esc(r.antibody)}" transform="translate(0 ${currentY})"><image href="${data}" xlink:href="${assetName || data}" x="${labelW}" width="${artW}" height="${h}" preserveAspectRatio="xMidYMid meet"/><rect x="${labelW}" width="${artW}" height="${h}" fill="none" stroke="#111" stroke-width="2"/><text x="${antibodyX}" y="${h / 2 + 7}" text-anchor="${antibodyAnchor}" class="label">${esc(r.antibody || r.name)}</text>${bands}</g>`;
            return s;
          })
          .join("");
        y = blockY;
        maxH = Math.max(maxH, markerBottom + 45);
        const mwHeaderX = p.labelSide === "antibody-right" ? labelW - 27 : labelW + artW + 27,
          mwHeader = panelMarkerLabels.length
            ? `<text x="${mwHeaderX}" y="${top - 14}" text-anchor="middle" class="mw">(kD)</text>`
            : "",
          out = `<g id="Panel ${esc(g.name)}" transform="translate(${panelX} 0)"><text x="${labelW}" y="25" class="panel">${esc(g.name)}</text>${mwHeader}${cond}${blocks}</g>`;
        panelX += labelW + artW + gap;
        return out;
      })
      .join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${panelX}" height="${maxH}" viewBox="0 0 ${panelX} ${maxH}"><style>.panel{font:700 ${size + 2}px ${family}}.label{font:${size}px ${family}}.cond{font:${size}px ${family}}.mw{font:${Math.max(9, size - 3)}px ${family}}</style>${panels}</svg>`;
  }
  async function editableFigurePdf() {
    const encoder = new TextEncoder(),
      helveticaWidths: Record<string, number> = {
        " ": 278,
        "!": 278,
        '"': 355,
        "#": 556,
        "$": 556,
        "%": 889,
        "&": 667,
        "'": 191,
        "(": 333,
        ")": 333,
        "*": 389,
        "+": 584,
        ",": 278,
        "-": 333,
        ".": 278,
        "/": 278,
        "0": 556,
        "1": 556,
        "2": 556,
        "3": 556,
        "4": 556,
        "5": 556,
        "6": 556,
        "7": 556,
        "8": 556,
        "9": 556,
        ":": 278,
        ";": 278,
        "<": 584,
        "=": 584,
        ">": 584,
        "?": 556,
        "@": 1015,
        A: 667,
        B: 667,
        C: 722,
        D: 722,
        E: 667,
        F: 611,
        G: 778,
        H: 722,
        I: 278,
        J: 500,
        K: 667,
        L: 556,
        M: 833,
        N: 722,
        O: 778,
        P: 667,
        Q: 778,
        R: 722,
        S: 667,
        T: 611,
        U: 722,
        V: 667,
        W: 944,
        X: 667,
        Y: 667,
        Z: 611,
        a: 556,
        b: 556,
        c: 500,
        d: 556,
        e: 556,
        f: 278,
        g: 556,
        h: 556,
        i: 222,
        j: 222,
        k: 500,
        l: 222,
        m: 833,
        n: 556,
        o: 556,
        p: 556,
        q: 556,
        r: 333,
        s: 500,
        t: 278,
        u: 556,
        v: 500,
        w: 722,
        x: 500,
        y: 500,
        z: 500,
      },
      pdfTextWidth = (value: string, fontSize: number) =>
        [...value].reduce(
          (sum, character) => sum + (helveticaWidths[character] ?? 556),
          0,
        ) *
        fontSize /
        1000,
      pdfText = (value: string) =>
        value
          .replaceAll("\\", "\\\\")
          .replaceAll("(", "\\(")
          .replaceAll(")", "\\)")
          .replaceAll(" ", "\\240"),
      rows = await Promise.all(
        allRegions.map(async (entry) => {
          const data = await cropData(entry.c, entry.r),
            image = await new Promise<HTMLImageElement>((resolve, reject) => {
              const element = new Image();
              element.onload = () => resolve(element);
              element.onerror = reject;
              element.src = data;
            }),
            canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d")!;
          context.drawImage(image, 0, 0);
          const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data,
            rgb = new Uint8Array(canvas.width * canvas.height * 3);
          for (let sourceIndex = 0, targetIndex = 0; sourceIndex < rgba.length; sourceIndex += 4) {
            rgb[targetIndex++] = rgba[sourceIndex];
            rgb[targetIndex++] = rgba[sourceIndex + 1];
            rgb[targetIndex++] = rgba[sourceIndex + 2];
          }
          let bytes = rgb,
            filter = "";
          if (typeof CompressionStream !== "undefined") {
            const compressed = await new Response(
              new Blob([rgb]).stream().pipeThrough(new CompressionStream("deflate")),
            ).arrayBuffer();
            bytes = new Uint8Array(compressed);
            filter = " /Filter /FlateDecode";
          }
          return { ...entry, imageWidth: canvas.width, imageHeight: canvas.height, bytes, filter };
        }),
      ),
      {maxWidth, labelW, gap, baseW} = figureMetrics(),
      size = Math.max(8, p.fontSize || 20),
      top =
        48 +
        Math.max(
          0,
          ...p.gels.map((gel) => {
            const artW = (baseW * gel.width) / maxWidth;
            return gel.conditions
              .filter((row) => row.visible)
              .reduce(
                (sum, row) =>
                  sum + conditionRowHeight(row, gel, artW, size),
                0,
              );
          }),
        ),
      panelLayouts = p.gels.map((gel) => {
        const artW = (baseW * gel.width) / maxWidth,
          items = rows.filter((entry) => entry.r.gelId === gel.id);
        let y = top;
        const blocks = items.map((entry) => {
          const source = entry.c.cl || entry.c.merge!,
            h = artW * entry.imageHeight / entry.imageWidth,
            block = { ...entry, y, h };
          y += h + 5;
          return block;
        });
        const markerCount = blocks.reduce((count, {r}) => count + figureMarkers(r).filter(marker => marker.on && marker.placed && marker.y >= r.y && marker.y <= r.y + r.h).length, 0);
        return { gel, artW, blocks, height: figureMarkerBottom(y, top, markerCount, Math.max(9, size - 3)) + 45 };
      }),
      width = 35 + panelLayouts.reduce((sum, panel) => sum + labelW + panel.artW + gap, 0),
      height = Math.max(top, ...panelLayouts.map((panel) => panel.height)),
      commands: string[] = ["0 0 0 RG", "0 0 0 rg"],
      unicodeOverlays: {
        value: string;
        x: number;
        topY: number;
        fontSize: number;
        align: "start" | "center" | "end";
        rotate: boolean;
      }[] = [],
      textCommand = (
        value: string,
        x: number,
        topY: number,
        fontSize: number,
        align: "start" | "center" | "end" = "start",
        bold = false,
      ) => {
        if (!value) return;
        if (/[^\x20-\x7e]/.test(value)) {
          unicodeOverlays.push({
            value,
            x,
            topY,
            fontSize,
            align,
            rotate: false,
          });
          return;
        }
        const safe = pdfText(value),
          estimatedWidth = pdfTextWidth(value, fontSize),
          adjustedX = align === "center" ? x - estimatedWidth / 2 : align === "end" ? x - estimatedWidth : x;
        commands.push(`BT /${bold ? "F2" : "F1"} ${fontSize} Tf ${adjustedX.toFixed(2)} ${(height - topY).toFixed(2)} Td (${safe}) Tj ET`);
      },
      adaptiveTextCommand = (
        value: string,
        x: number,
        y: number,
        availableWidth: number,
        forceRotate = false,
      ) => {
        if (!value) return;
        const layout = autoLabelLayout(value, availableWidth, size);
        const effectiveSize = size * layout.fontScale;
        if (forceRotate || layout.mode === "rotate") {
          if (/[^\x20-\x7e]/.test(value)) {
            unicodeOverlays.push({
              value,
              x,
              topY: y,
              fontSize: effectiveSize,
              align: "center",
              rotate: true,
            });
            return;
          }
          const asciiValue = pdfText(value),
            estimatedWidth = pdfTextWidth(value, effectiveSize);
          commands.push(
            `BT /F1 ${effectiveSize} Tf 0 1 -1 0 ${(x + effectiveSize * 0.35).toFixed(2)} ${(height - y - estimatedWidth / 2).toFixed(2)} Tm (${asciiValue}) Tj ET`,
          );
        } else if (layout.mode === "wrap") {
          layout.lines.forEach((line, index) =>
            textCommand(
              line,
              x,
              y +
                (index - (layout.lines.length - 1) / 2) *
                  effectiveSize *
                  1.05,
              effectiveSize,
              "center",
            ),
          );
        } else textCommand(value, x, y, effectiveSize, "center");
      },
      lineCommand = (x1: number, y1: number, x2: number, y2: number, lineWidth = 1) =>
        commands.push(`${lineWidth} w ${x1.toFixed(2)} ${(height - y1).toFixed(2)} m ${x2.toFixed(2)} ${(height - y2).toFixed(2)} l S`),
      rectCommand = (x: number, y: number, w: number, h: number, lineWidth = 1) =>
        commands.push(`${lineWidth} w ${x.toFixed(2)} ${(height - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
    let panelX = 35,
      imageIndex = 0;
    panelLayouts.forEach(({ gel, artW, blocks, height: panelHeight }) => {
      const imageX = panelX + labelW,
        laneX = (lanePosition: number) =>
          imageX + artW * (gel.laneCenter / 100 + (lanePosition / gel.lanes - 0.5) * (gel.laneSpan / 100)),
        groupLineStart = (start: number) => laneX(start + 0.3),
        groupLineEnd = (end: number) => laneX(end - 0.3),
        hasPanelMarkers = blocks.some(({ r }) =>
          figureMarkers(r).some(
            (marker) =>
              marker.on &&
              marker.placed &&
              marker.y >= r.y &&
              marker.y <= r.y + r.h,
          ),
        );
      textCommand(gel.name, imageX, 25, size + 2, "start", true);
      if (hasPanelMarkers)
        textCommand("(kD)", p.labelSide === "antibody-right" ? imageX - 27 : imageX + artW + 27, top - 14, Math.max(9, size - 3), "center");
      const visibleConditions = gel.conditions.filter((row) => row.visible);
      const rowHeights = visibleConditions.map((row) =>
        conditionRowHeight(row, gel, artW, size),
      ),
        conditionTop = conditionRowsStart(top, rowHeights);
      visibleConditions.forEach((row, rowIndex) => {
        const rowStart =
            conditionTop +
            rowHeights.slice(0, rowIndex).reduce((sum, value) => sum + value, 0),
          forceRotate = conditionRowNeedsRotation(row, gel, artW, size),
          hasWrap = conditionRowHasWrap(row, gel, artW, size),
          rowY =
            rowStart +
            rowHeights[rowIndex] / 2 +
            (forceRotate ? 0 : hasWrap ? -size * 0.15 : size * 0.35),
          rowLineY = rowStart + rowHeights[rowIndex] - 4,
          laneWidth =
            (artW * (gel.laneSpan / 100)) / Math.max(1, gel.lanes);
        textCommand(row.name, p.labelSide === "antibody-right" ? imageX + artW + 14 : imageX - 12, rowY, size, p.labelSide === "antibody-right" ? "start" : "end");
        if (row.groups?.length)
          row.groups.forEach((group) => {
            if (!group.label.trim()) return;
            const start = Math.max(0, group.start),
              end = Math.min(gel.lanes, start + group.span);
            adaptiveTextCommand(group.label, laneX((start + end) / 2), rowY, laneWidth * Math.max(1, end - start) - 8, forceRotate);
            if (groupShowsSeparator(row, group)) lineCommand(groupLineStart(start), rowLineY, groupLineEnd(end), rowLineY);
          });
        else if ((row.groupSize || 1) > 1) {
          const groupSize = Math.max(1, row.groupSize || 1);
          for (let start = 0; start < gel.lanes; start += groupSize) {
            const end = Math.min(gel.lanes, start + groupSize);
            adaptiveTextCommand(row.values[start] || "", laneX((start + end) / 2), rowY, laneWidth * (end - start) - 8, forceRotate);
            if (row.lineBelow) lineCommand(groupLineStart(start), rowLineY, groupLineEnd(end), rowLineY);
          }
        } else row.values.forEach((value, index) => adaptiveTextCommand(value, laneX(index + 0.5), rowY, laneWidth - 8, forceRotate));
      });
      const markerFontSize = Math.max(9, size - 3),
        panelBottom = Math.max(
          top,
          ...blocks.map(({ y, h }) => y + h),
        ),
        panelMarkerLabels = markerLabelPositions(
          blocks.flatMap(({ r, y, h }) =>
            figureMarkers(r)
              .filter(
                (marker) =>
                  marker.on &&
                  marker.placed &&
                  marker.y >= r.y &&
                  marker.y <= r.y + r.h,
              )
              .map((marker) => ({
                key: `${r.id}:${marker.mw}`,
                mw: marker.mw,
                markerY: y + ((marker.y - r.y) / r.h) * h,
              })),
          ),
          panelHeight - 45,
          markerFontSize,
          top,
          panelHeight - 45,
        ),
        markerLabelMap = new Map(
          panelMarkerLabels.map((marker) => [marker.key, marker]),
        );
      blocks.forEach(({ r, y, h }) => {
        imageIndex++;
        commands.push(`q ${artW.toFixed(2)} 0 0 ${h.toFixed(2)} ${imageX.toFixed(2)} ${(height - y - h).toFixed(2)} cm /Im${imageIndex} Do Q`);
        rectCommand(imageX, y, artW, h, 2);
        textCommand(
          r.antibody || r.name,
          p.labelSide === "antibody-right" ? imageX + artW + 14 : imageX - 12,
          y + h / 2 + 7,
          size,
          p.labelSide === "antibody-right" ? "start" : "end",
        );
        figureMarkers(r)
          .filter(
            (marker) =>
              marker.on &&
              marker.placed &&
              marker.y >= r.y &&
              marker.y <= r.y + r.h,
          )
          .forEach((marker) => {
            const placed = markerLabelMap.get(`${r.id}:${marker.mw}`)!,
              markerY = placed.markerY,
              labelY = placed.labelY,
              labelMid = labelY - markerFontSize * 0.25,
              shifted =
                Math.abs(
                  labelY - (markerY + markerFontSize * 0.35),
                ) > 1;
            if (p.labelSide === "antibody-right") {
              lineCommand(imageX, markerY, imageX - 12, markerY, 2);
              if (shifted) {
                lineCommand(
                  imageX - 12,
                  markerY,
                  imageX - 12,
                  labelMid,
                );
                lineCommand(imageX - 12, labelMid, imageX - 19, labelMid);
              }
              textCommand(String(marker.mw), imageX - 27, labelY, markerFontSize, "center");
            } else {
              lineCommand(imageX + artW, markerY, imageX + artW + 12, markerY, 2);
              if (shifted) {
                lineCommand(
                  imageX + artW + 12,
                  markerY,
                  imageX + artW + 12,
                  labelMid,
                );
                lineCommand(
                  imageX + artW + 12,
                  labelMid,
                  imageX + artW + 19,
                  labelMid,
                );
              }
              textCommand(String(marker.mw), imageX + artW + 27, labelY, markerFontSize, "center");
            }
          });
      });
      panelX += labelW + artW + gap;
    });
    const imageStart = 6,
      contentObjectNumber = imageStart + rows.length,
      xObjects = rows.map((_, index) => `/Im${index + 1} ${imageStart + index} 0 R`).join(" "),
      targetContentWidth = (p.panelWidthMm * 72) / 25.4,
      margin = 4,
      pageScale = targetContentWidth / Math.max(1, width),
      pageWidth = targetContentWidth + margin * 2,
      pageHeight = height * pageScale + margin * 2,
      offsetX = margin,
      offsetY = margin,
      content = `q ${pageScale.toFixed(6)} 0 0 ${pageScale.toFixed(6)} ${offsetX.toFixed(2)} ${offsetY.toFixed(2)} cm\n${commands.join("\n")}\nQ`,
      objects: (string | Uint8Array)[] = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << ${xObjects} >> >> /Contents ${contentObjectNumber} 0 R >>`,
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
        ...rows.map((row) =>
          joinBytes([
            encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${row.imageWidth} /Height ${row.imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8${row.filter} /Length ${row.bytes.length} >>\nstream\n`),
            row.bytes,
            encoder.encode("\nendstream"),
          ]),
        ),
        `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`,
      ],
      chunks: Uint8Array[] = [encoder.encode("%PDF-1.4\n%âãÏÓ\n")],
      offsets = [0];
    let byteLength = chunks[0].length;
    objects.forEach((object, index) => {
      offsets.push(byteLength);
      const body = typeof object === "string" ? encoder.encode(object) : object,
        chunk = joinBytes([encoder.encode(`${index + 1} 0 obj\n`), body, encoder.encode("\nendobj\n")]);
      chunks.push(chunk);
      byteLength += chunk.length;
    });
    const xrefOffset = byteLength,
      xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    const basePdf = new Blob(
      [...chunks, encoder.encode(xref)].map((bytes) =>
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer,
      ),
      { type: "application/pdf" },
    );
    if (!unicodeOverlays.length) return basePdf;
    const [{ degrees, PDFDocument, rgb }, { default: fontkit }] =
      await Promise.all([import("pdf-lib"), import("@pdf-lib/fontkit")]);
    const pdfDocument = await PDFDocument.load(await basePdf.arrayBuffer());
    pdfDocument.registerFontkit(fontkit);
    const fontResponse = await fetch(
      new URL("./fonts/NotoSansMath-Regular.ttf", window.document.baseURI),
    );
    if (!fontResponse.ok)
      throw new Error("Unicode PDFフォントを読み込めませんでした");
    const unicodeFont = await pdfDocument.embedFont(
        await fontResponse.arrayBuffer(),
        { subset: false },
      ),
      page = pdfDocument.getPages()[0];
    unicodeOverlays.forEach((overlay) => {
      const value = overlay.value.replaceAll("＋", "+"),
        fontSize = overlay.fontSize * pageScale,
        textWidth = unicodeFont.widthOfTextAtSize(value, fontSize);
      if (overlay.rotate) {
        page.drawText(value, {
          x: offsetX + (overlay.x + overlay.fontSize * 0.35) * pageScale,
          y:
            offsetY +
            (height - overlay.topY) * pageScale -
            textWidth / 2,
          size: fontSize,
          font: unicodeFont,
          color: rgb(0, 0, 0),
          rotate: degrees(90),
        });
      } else {
        const anchorX = offsetX + overlay.x * pageScale,
          drawX =
            overlay.align === "center"
              ? anchorX - textWidth / 2
              : overlay.align === "end"
                ? anchorX - textWidth
                : anchorX;
        page.drawText(value, {
          x: drawX,
          y: offsetY + (height - overlay.topY) * pageScale,
          size: fontSize,
          font: unicodeFont,
          color: rgb(0, 0, 0),
        });
      }
    });
    return new Blob([new Uint8Array(await pdfDocument.save())], {
      type: "application/pdf",
    });
  }
  async function exportEditablePdf() {
    try {
      setNotice("編集可能PDFを生成しています…");
      saveBlob(
        `${safeProjectFileStem(p.name)}-figure-editable-${p.panelWidthMm}mm.pdf`,
        await editableFigurePdf(),
      );
      setNotice(
        `編集可能PDFをFigure幅${p.panelWidthMm} mmで保存しました`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "編集可能PDFの生成に失敗しました");
    }
  }
  function sourceRecordEntries() {
    return p.captures.flatMap((capture) => {
      const entries: { capture: Capture; image: Img; role: "CL" | "Merge" }[] = [];
      if (
        (p.sourceRecordMode === "cl" || p.sourceRecordMode === "both") &&
        capture.cl
      )
        entries.push({ capture, image: capture.cl, role: "CL" });
      if (
        (p.sourceRecordMode === "merge" || p.sourceRecordMode === "both") &&
        capture.merge
      )
        entries.push({ capture, image: capture.merge, role: "Merge" });
      return entries;
    });
  }
  async function evidenceSvg(externalPrefix = "") {
    const cardSpecs = sourceRecordEntries().flatMap(({ capture, image, role }) => {
      const regions = capture.regions.length ? capture.regions : [undefined];
      const groups = new Map<string, (Region | undefined)[]>();
      regions.forEach((region) => {
        const adjustment = region?.adjustment,
          rotation = region
            ? capture.gelRotations?.[region.gelId] ?? region.rotation ?? capture.rotation
            : capture.rotation,
          adjustmentKey =
            role === "CL" && adjustment?.mode === "minmax"
              ? `${adjustment.min}:${adjustment.max}:${adjustment.invert}`
              : role === "CL" && adjustment?.levels
                ? `legacy:${adjustment.levels.low}:${adjustment.levels.high}:${adjustment.invert}`
                : "auto",
          key = `${region?.gelId || "capture"}:${rotation}:${adjustmentKey}`;
        groups.set(key, [...(groups.get(key) || []), region]);
      });
      return [...groups.values()].map((group) => ({ capture, image, role, regions: group }));
    });
    const cards = await Promise.all(
      cardSpecs.map(async ({ capture, image, role, regions }) => {
        const region = regions.find(Boolean),
          adjustment = region?.adjustment,
          rotation = region
            ? capture.gelRotations?.[region.gelId] ?? region.rotation ?? capture.rotation
            : capture.rotation;
        try {
          let displayData = image.data,
            description = "display auto";
          if (role === "CL" && adjustment?.mode === "minmax") {
            displayData =
              adjustment.preview ||
              (await rawAdjustedData(image, {
                min: adjustment.min ?? 0,
                max: adjustment.max ?? 2 ** (adjustment.bitDepth || image.bitsPerSample || 8) - 1,
                bitDepth: adjustment.bitDepth || image.bitsPerSample || 8,
                invert: adjustment.invert,
              }));
            description = `Figure Min/Max ${adjustment.min}–${adjustment.max}, invert ${adjustment.invert ? "on" : "off"}`;
          } else if (role === "CL" && adjustment?.preview) {
            displayData = await filteredPreviewData(
              adjustment.preview,
              image.width,
              image.height,
              adjustment.brightness,
              adjustment.contrast,
            );
            description = "legacy Figure adjustment";
          } else {
            const adjusted = await autoLevels(image, false);
            displayData = adjusted.preview;
            description = `visibility auto ${adjusted.levels.low}–${adjusted.levels.high}`;
          }
          return {
            capture,
            image,
            role,
            regions,
            rotation,
            displayData: await rotatedPreviewData(
              displayData,
              image.width,
              image.height,
              rotation,
            ),
            description,
          };
        } catch {
          return {
            capture,
            image,
            role,
            regions,
            rotation,
            displayData: image.data,
            description: "display adjustment unavailable",
          };
        }
      }),
    );
    const W = 1300,
      cardW = 560;
    let y = 85;
    const body = cards
      .map(({ capture: c, image: im, role, regions, rotation, displayData, description }, i) => {
        const
          h = (cardW * im.height) / im.width;
        const x = i % 2 ? 680 : 50;
        if (i > 0 && i % 2 === 0) y += h + 150;
        const boxes = regions.filter(Boolean)
          .map(
            (item) => {
              const r = item!;
              return `<rect x="${(cardW * (r.x ?? p.cropX)) / 100}" y="${(h * r.y) / 100}" width="${(cardW * gelWidth(r.gelId)) / 100}" height="${(h * r.h) / 100}" fill="none" stroke="#e53935" stroke-width="4"/><text x="${(cardW * (r.x ?? p.cropX)) / 100 + 5}" y="${(h * r.y) / 100 - 6}" class="red">${esc(r.name)} · ${esc(p.gels.find((g) => g.id === r.gelId)?.name || "")} · ${esc(r.antibody)}</text>`;
            },
          )
          .join("");
        const assetName = externalPrefix
          ? `${externalPrefix}-source-image-${String(i + 1).padStart(2, "0")}.png`
          : "";
        return `<g transform="translate(${x} ${y})"><text y="-14" class="name">${esc(c.key)} · ${role} · ${esc(im.name)}</text><image href="${displayData}" xlink:href="${assetName || displayData}" width="${cardW}" height="${h}"/>${boxes}<text y="${h + 25}" class="meta">${role} · rotation ${rotation.toFixed(2)}° · ${esc(description)} · raw source linked by project JSON</text></g>`;
      })
      .join("");
    const H =
      y +
      (cards.at(-1)?.image
        ? (cardW * cards.at(-1)!.image.height) /
          cards.at(-1)!.image.width
        : 0) +
      100;
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}"><style>.title{font:700 28px Arial}.name{font:700 16px Arial}.meta{font:14px Arial;fill:#555}.red{font:700 14px Arial;fill:#e53935}</style><rect width="100%" height="100%" fill="white"/><text x="50" y="45" class="title">${esc(p.name)} · source record</text>${body}</svg>`;
  }
  async function exportEvidence() {
    save(`${safeProjectFileStem(p.name)}-source-record.svg`, await evidenceSvg());
    patch((project) => {
      project.confirmations ??= {};
      project.confirmations.sourceRecordReviewed = true;
      return project;
    });
    setNotice(
      "自己完結型の保全SVGを保存しました。Illustratorで開けない場合は完成画像形式を使用してください",
    );
  }
  async function exportFigure() {
    save(`${safeProjectFileStem(p.name)}-figure-editable.svg`, await figureSvg());
    patch((project) => {
      project.confirmations ??= {};
      project.confirmations.exportReviewed = true;
      return project;
    });
    setNotice(
      "自己完結型SVGを1ファイルで保存しました。Illustrator互換性は環境により異なります",
    );
  }
  async function renderFigureCanvas(scale = 3, onlyGelId?: string) {
    const rows = await Promise.all(
        allRegions.filter(entry => !onlyGelId || entry.r.gelId === onlyGelId).map(async (entry) => {
          const data = await cropData(entry.c, entry.r),
            image = await new Promise<HTMLImageElement>((resolve, reject) => {
              const element = new Image();
              element.onload = () => resolve(element);
              element.onerror = reject;
              element.src = data;
            });
          return { ...entry, image };
        }),
      ),
      {maxWidth, labelW, gap, baseW} = figureMetrics(),
      family = p.fontFamily || "Helvetica",
      size = Math.max(8, p.fontSize || 20),
      top =
        48 +
        Math.max(
          0,
          ...p.gels.map(
            (gel) => {
              const artW = (baseW * gel.width) / maxWidth;
              return gel.conditions
                .filter((row) => row.visible)
                .reduce(
                  (sum, row) =>
                    sum + conditionRowHeight(row, gel, artW, size),
                  0,
                );
            },
          ),
        ),
      panelLayouts = p.gels.filter(gel => !onlyGelId || gel.id === onlyGelId).map((gel) => {
        const artW = (baseW * gel.width) / maxWidth,
          items = rows.filter((entry) => entry.r.gelId === gel.id);
        let y = top;
        const blocks = items.map((entry) => {
          const source = entry.c.cl || entry.c.merge!,
            h = artW * entry.image.naturalHeight / entry.image.naturalWidth,
            block = { ...entry, y, h };
          y += h + 5;
          return block;
        });
        const markerCount = blocks.reduce((count, {r}) => count + figureMarkers(r).filter(marker => marker.on && marker.placed && marker.y >= r.y && marker.y <= r.y + r.h).length, 0);
        return { gel, artW, blocks, height: figureMarkerBottom(y, top, markerCount, Math.max(9, size - 3)) + 45 };
      }),
      width =
        35 +
        panelLayouts.reduce(
          (total, panel) => total + labelW + panel.artW + gap,
          0,
        ),
      height = Math.max(top, ...panelLayouts.map((panel) => panel.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d")!;
    context.scale(scale, scale);
    context.fillStyle = "white";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#111";
    context.strokeStyle = "#111";
    context.textBaseline = "alphabetic";
    const drawAdaptiveLabel = (
      value: string,
      x: number,
      y: number,
      availableWidth: number,
      forceRotate = false,
    ) => {
      if (!value) return;
      const layout = autoLabelLayout(value, availableWidth, size);
      const effectiveSize = size * layout.fontScale;
      context.textAlign = "center";
      context.font = `${effectiveSize}px ${family}`;
      if (forceRotate || layout.mode === "rotate") {
        context.save();
        context.translate(x, y);
        context.rotate(-Math.PI / 2);
        context.fillText(value, 0, 0);
        context.restore();
      } else if (layout.mode === "wrap") {
        layout.lines.forEach((line, index) =>
          context.fillText(
            line,
            x,
            y +
              (index - (layout.lines.length - 1) / 2) *
                effectiveSize *
                1.05,
          ),
        );
      } else context.fillText(value, x, y);
    };
    let panelX = 35;
    panelLayouts.forEach(({ gel, artW, blocks, height: panelHeight }) => {
      const imageX = panelX + labelW,
        laneX = (lanePosition: number) =>
          imageX +
          artW *
            (gel.laneCenter / 100 +
              (lanePosition / gel.lanes - 0.5) * (gel.laneSpan / 100)),
        groupLineStart = (start: number) => laneX(start + 0.3),
        groupLineEnd = (end: number) => laneX(end - 0.3),
        hasPanelMarkers = blocks.some(({ r }) =>
          figureMarkers(r).some(
            (marker) =>
              marker.on &&
              marker.placed &&
              marker.y >= r.y &&
              marker.y <= r.y + r.h,
          ),
        );
      context.font = `700 ${size + 2}px ${family}`;
      context.textAlign = "start";
      context.fillText(gel.name, imageX, 25);
      context.font = `${Math.max(9, size - 3)}px ${family}`;
      context.textAlign = "center";
      if (hasPanelMarkers)
        context.fillText("(kD)", p.labelSide === "antibody-right" ? imageX - 27 : imageX + artW + 27, top - 14);
      const visibleConditions = gel.conditions.filter((row) => row.visible);
      const rowHeights = visibleConditions.map((row) =>
        conditionRowHeight(row, gel, artW, size),
      ),
        conditionTop = conditionRowsStart(top, rowHeights);
      context.font = `${size}px ${family}`;
      visibleConditions.forEach((row, rowIndex) => {
        const rowStart =
            conditionTop +
            rowHeights.slice(0, rowIndex).reduce((sum, value) => sum + value, 0),
          forceRotate = conditionRowNeedsRotation(row, gel, artW, size),
          hasWrap = conditionRowHasWrap(row, gel, artW, size),
          rowY =
            rowStart +
            rowHeights[rowIndex] / 2 +
            (forceRotate ? 0 : hasWrap ? -size * 0.15 : size * 0.35),
          rowLineY = rowStart + rowHeights[rowIndex] - 4,
          laneWidth =
            (artW * (gel.laneSpan / 100)) / Math.max(1, gel.lanes);
        context.textAlign = p.labelSide === "antibody-right" ? "start" : "end";
        context.fillText(row.name, p.labelSide === "antibody-right" ? imageX + artW + 14 : imageX - 12, rowY);
        context.textAlign = "center";
        if (row.groups?.length) {
          row.groups.forEach((group) => {
            if (!group.label.trim()) return;
            const start = Math.max(0, group.start),
              end = Math.min(gel.lanes, start + group.span);
            drawAdaptiveLabel(group.label, laneX((start + end) / 2), rowY, laneWidth * Math.max(1, end - start) - 8, forceRotate);
            if (groupShowsSeparator(row, group)) {
              context.beginPath();
              context.moveTo(groupLineStart(start), rowLineY);
              context.lineTo(groupLineEnd(end), rowLineY);
              context.stroke();
            }
          });
        } else if ((row.groupSize || 1) > 1) {
          const groupSize = Math.max(1, row.groupSize || 1);
          for (let start = 0; start < gel.lanes; start += groupSize) {
            const end = Math.min(gel.lanes, start + groupSize);
            drawAdaptiveLabel(row.values[start] || "", laneX((start + end) / 2), rowY, laneWidth * (end - start) - 8, forceRotate);
            if (row.lineBelow) {
              context.beginPath();
              context.moveTo(groupLineStart(start), rowLineY);
              context.lineTo(groupLineEnd(end), rowLineY);
              context.stroke();
            }
          }
        } else
          row.values.forEach((value, index) =>
            drawAdaptiveLabel(value, laneX(index + 0.5), rowY, laneWidth - 8, forceRotate),
          );
        context.font = `${size}px ${family}`;
      });
      const markerFontSize = Math.max(9, size - 3),
        panelBottom = Math.max(
          top,
          ...blocks.map(({ y, h }) => y + h),
        ),
        panelMarkerLabels = markerLabelPositions(
          blocks.flatMap(({ r, y, h }) =>
            figureMarkers(r)
              .filter(
                (marker) =>
                  marker.on &&
                  marker.placed &&
                  marker.y >= r.y &&
                  marker.y <= r.y + r.h,
              )
              .map((marker) => ({
                key: `${r.id}:${marker.mw}`,
                mw: marker.mw,
                markerY: y + ((marker.y - r.y) / r.h) * h,
              })),
          ),
          panelHeight - 45,
          markerFontSize,
          top,
          panelHeight - 45,
        ),
        markerLabelMap = new Map(
          panelMarkerLabels.map((marker) => [marker.key, marker]),
        );
      blocks.forEach(({ r, image, y, h }) => {
        context.drawImage(image, imageX, y, artW, h);
        context.lineWidth = 2;
        context.strokeRect(imageX, y, artW, h);
        context.font = `${size}px ${family}`;
        context.textAlign = p.labelSide === "antibody-right" ? "start" : "end";
        context.fillText(r.antibody || r.name, p.labelSide === "antibody-right" ? imageX + artW + 14 : imageX - 12, y + h / 2 + 7);
        context.font = `${markerFontSize}px ${family}`;
        context.textAlign = "center";
        figureMarkers(r)
          .filter(
            (marker) =>
              marker.on &&
              marker.placed &&
              marker.y >= r.y &&
              marker.y <= r.y + r.h,
          )
          .forEach((marker) => {
            const placed = markerLabelMap.get(`${r.id}:${marker.mw}`)!,
              markerY = placed.markerY,
              labelY = placed.labelY,
              labelMid = labelY - markerFontSize * 0.25,
              shifted =
                Math.abs(
                  labelY - (markerY + markerFontSize * 0.35),
                ) > 1,
              edgeX =
                p.labelSide === "antibody-right"
                  ? imageX - 12
                  : imageX + artW + 12;
            context.lineWidth = 2;
            context.beginPath();
            context.moveTo(p.labelSide === "antibody-right" ? imageX : imageX + artW, markerY);
            context.lineTo(edgeX, markerY);
            context.stroke();
            if (shifted) {
              context.lineWidth = 1;
              context.beginPath();
              context.moveTo(edgeX, markerY);
              context.lineTo(edgeX, labelMid);
              context.lineTo(
                p.labelSide === "antibody-right"
                  ? imageX - 19
                  : imageX + artW + 19,
                labelMid,
              );
              context.stroke();
            }
            context.fillText(
              String(marker.mw),
              p.labelSide === "antibody-right"
                ? imageX - 27
                : imageX + artW + 27,
              labelY,
            );
          });
      });
      panelX += labelW + artW + gap;
    });
    return canvas;
  }
  async function exportFlatFigure(format: "png" | "jpeg" | "tiff" | "pdf") {
    try {
      setNotice(`${format.toUpperCase()}を生成しています…`);
      const canvas = await renderFigureCanvas(3),
        prefix = `${safeProjectFileStem(p.name)}-figure`;
      if (format === "png")
        saveBlob(`${prefix}.png`, await canvasBlob(canvas, "image/png"));
      else if (format === "jpeg")
        saveBlob(
          `${prefix}.jpg`,
          await canvasBlob(canvas, "image/jpeg", 0.96),
        );
      else if (format === "pdf") {
        const jpeg = await canvasBlob(canvas, "image/jpeg", 0.98);
        saveBlob(
          `${prefix}.pdf`,
          await jpegPdf(jpeg, canvas.width, canvas.height),
        );
      } else {
        await loadUtif();
        if (!window.UTIF?.encodeImage)
          throw new Error("このブラウザではTIFF生成を利用できません");
        const pixels = canvas
            .getContext("2d")!
            .getImageData(0, 0, canvas.width, canvas.height).data,
          encoded = window.UTIF.encodeImage(
            new Uint8Array(pixels.buffer),
            canvas.width,
            canvas.height,
          );
        saveBlob(`${prefix}.tif`, new Blob([encoded], { type: "image/tiff" }));
      }
      setNotice(
        `${format === "jpeg" ? "JPEG" : format.toUpperCase()}完成画像を保存しました（3倍解像度）`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : `${format.toUpperCase()}の生成に失敗しました`,
      );
    }
  }
  function conditionSettingsData() {
    return JSON.stringify(
      {
        type: "BlotCanvasTemplate",
        version: 2,
        gels: p.gels.map(
          ({ name, width, lanes, conditions, laneCenter, laneSpan }) => ({
            name,
            width,
            lanes,
            conditions,
            laneCenter,
            laneSpan,
          }),
        ),
        fontFamily: p.fontFamily,
        fontSize: p.fontSize,
        markerPresets: p.markerPresets,
        activeMarkerPreset,
      },
      null,
      2,
    );
  }
  function linkedProjectData(confirmations = p.confirmations) {
    return JSON.stringify(
      createLinkedProjectSnapshot({ ...p, confirmations }),
      null,
      2,
    );
  }
  function reviewSheetSvg(
    figure: string,
    evidence: string,
    externalFigure = "",
    externalEvidence = "",
  ) {
    const [width, height] = p.pageSize === "A4" ? [794, 1123] : [816, 1056],
      figureHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(figure)}`,
      evidenceHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(evidence)}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><text x="32" y="32" font-family="Helvetica" font-size="18" font-weight="700">${esc(p.name)} · Figure</text><image href="${figureHref}" xlink:href="${externalFigure || figureHref}" x="32" y="45" width="${width - 64}" height="${height * 0.42}" preserveAspectRatio="xMidYMin meet"/><line x1="32" x2="${width - 32}" y1="${height * 0.49}" y2="${height * 0.49}" stroke="#bbb"/><text x="32" y="${height * 0.52}" font-family="Helvetica" font-size="18" font-weight="700">Source record</text><image href="${evidenceHref}" xlink:href="${externalEvidence || evidenceHref}" x="32" y="${height * 0.54}" width="${width - 64}" height="${height * 0.42}" preserveAspectRatio="xMidYMin meet"/></svg>`;
  }
  async function exportFilesIndividually() {
    try {
      setNotice("出力ファイルを作成しています…");
      const prefix = safeProjectFileStem(p.name),
        figureName = `${prefix}-figure-editable.svg`,
        evidenceName = `${prefix}-source-record.svg`,
        figure = await figureSvg(),
        evidence = await evidenceSvg(),
        review = reviewSheetSvg(figure, evidence),
        filesToDownload = [
          [figureName, figure, "image/svg+xml"],
          [evidenceName, evidence, "image/svg+xml"],
          [`${prefix}-review-${p.pageSize}.svg`, review, "image/svg+xml"],
          [
            `${prefix}-project.json`,
            linkedProjectData({
              exportReviewed: true,
              sourceRecordReviewed: true,
            }),
            "application/json",
          ],
          [`${prefix}-settings-template.json`, conditionSettingsData(), "application/json"],
        ] as const;
      filesToDownload.forEach(([name, data, type]) => save(name, data, type));
      patch((project) => {
        project.confirmations = {
          exportReviewed: true,
          sourceRecordReviewed: true,
        };
        return project;
      });
      const hasQuantification = (p.quantification?.targets || []).some(
        (target) => target.measurements.length,
      );
      if (hasQuantification) exportQuantCsv();
      if (hasQuantification) exportQuantRoiRecord();
      setNotice(
        `${5 + (hasQuantification ? 2 : 0)}個のファイルを保存しました（プロジェクトJSONは元画像参照型です）`,
      );
    } catch {
      setNotice("ファイル作成に失敗しました");
    }
  }
  function saveProject() {
    save(
      `${safeProjectFileStem(p.name)}.json`,
      linkedProjectData(),
      "application/json",
    );
    setNotice("軽量プロジェクトJSONを保存しました。元画像フォルダと一緒に保管してください");
  }
  function saveConditionSettings() {
    save(
      `${p.name.replace(/\W+/g, "-") || "WB"}-settings-template.json`,
      conditionSettingsData(),
      "application/json",
    );
  }
  async function openConditionSettings(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (
        !["BlotCanvasConditions", "BlotCanvasTemplate"].includes(data.type) ||
        !Array.isArray(data.gels)
      )
        throw new Error();
      patch((project) => {
        data.gels.forEach(
          (
            saved: {
              name: string;
              width?: number;
              lanes: number;
              conditions: Condition[];
              laneCenter: number;
              laneSpan: number;
            },
            i: number,
          ) => {
            let gel =
              project.gels.find((item) => item.name === saved.name) ||
              project.gels[i];
            if (!gel) {
              gel = {
                id: uid(),
                name: saved.name || `Gel ${i + 1}`,
                width: saved.width ?? 84,
                lanes: saved.lanes,
                conditions: [],
                laneCenter: saved.laneCenter ?? 50,
                laneSpan: saved.laneSpan ?? 100,
              };
              project.gels.push(gel);
            }
            gel.name = saved.name || gel.name;
            gel.width = saved.width ?? gel.width;
            gel.lanes = saved.lanes;
            gel.conditions = saved.conditions.map((row) => ({
              ...row,
              id: uid(),
            }));
            gel.laneCenter = saved.laneCenter ?? 50;
            gel.laneSpan = saved.laneSpan ?? 100;
          },
        );
        project.fontFamily = data.fontFamily || project.fontFamily;
        project.fontSize = data.fontSize || project.fontSize;
        if (Array.isArray(data.markerPresets)) {
          const presets = new Map(
            [...project.markerPresets, ...data.markerPresets].map(
              (preset: MarkerPreset) => [preset.id, preset],
            ),
          );
          project.markerPresets = [...presets.values()];
        }
        return project;
      });
      if (data.activeMarkerPreset) setActiveMarkerPreset(data.activeMarkerPreset);
      setNotice("条件表・マーカー種類などの設定を読み込みました");
    } catch {
      setNotice("設定テンプレートJSONを読み込めませんでした");
    }
    e.target.value = "";
  }
  function restoreParsedProject(q: Project) {
      if (![2, 3].includes(q.version)) throw new Error("unsupported project version");
      const legacyProject = q.version === 2;
      q.gels ??= [
        {
          id: uid(),
          name: "Gel 1",
          width: q.cropW || 84,
          lanes: q.lanes || 6,
          conditions: q.conditions || defaultConditions(q.lanes || 6),
          laneCenter: 50,
          laneSpan: 100,
        },
      ];
      q.gels.forEach((g) => {
        g.lanes ??= q.lanes || 6;
        g.conditions ??= structuredClone(
          q.conditions || defaultConditions(g.lanes),
        );
        g.laneCenter ??= 50;
        g.laneSpan ??= 100;
        g.markerState ??= g.conditions?.length ? "unconfirmed" : "unconfirmed";
      });
      q.fontFamily ??= "Helvetica";
      q.fontSize ??= 20;
      q.markerPresets = [
        ...structuredClone(BUILTIN_MARKER_PRESETS),
        ...(q.markerPresets || []).filter(
          (preset) =>
            !BUILTIN_MARKER_PRESETS.some((builtIn) => builtIn.id === preset.id),
        ),
      ];
      q.pageSize ??= isEnglishUi() ? "Letter" : "A4";
      q.panelWidthMm ??= 25.5;
      q.sourceRecordMode ??= "merge";
      q.labelSide ??= "antibody-left";
      q.syncGelOrder ??= false;
      q.quantification ??= {
        targets: [],
        normalizationRegionIds: {},
        valueMode: "correctedIntegrated",
        nonDetectMode: "nd",
        colors: {},
        graph: {
          type: "bar",
          fontFamily: "Helvetica",
          fontSize: 16,
          width: 700,
          height: 560,
          showValues: false,
          title: "",
          palette: "nature",
          customColors: [...GRAPH_PALETTES.nature],
        },
      };
      q.quantification.graph ??= {
        type: "bar",
        fontFamily: "Helvetica",
        fontSize: 16,
        width: 700,
        height: 560,
        showValues: false,
        title: "",
        palette: "nature",
        customColors: [...GRAPH_PALETTES.nature],
      };
      q.quantification.graph.palette ??= "nature";
      q.quantification.graph.customColors ??= [...GRAPH_PALETTES.nature];
      q.quantification.graph.title ??= "";
      q.quantification.nonDetectMode ??= "nd";
      q.quantification.normalizationRegionIds ??= {};
      if (
        q.quantification.normalizationRegionId &&
        !Object.keys(q.quantification.normalizationRegionIds).length
      ) {
        const legacyEntry = q.captures
          .flatMap((capture) => capture.regions)
          .find(
            (region) =>
              region.id === q.quantification?.normalizationRegionId,
          );
        if (legacyEntry)
          q.quantification.normalizationRegionIds[legacyEntry.gelId] =
            q.quantification.normalizationRegionId;
      }
      q.captures.forEach((c) => {
        c.antibodies ??= [];
        c.gelRotations ??= {};
        c.regions.forEach((r) => {
          r.x ??= q.cropX;
          r.gelId ??= q.gels[0].id;
          r.antibody ??= c.antibodies[0] || r.name || "Target";
          r.markerPresetId ??=
            markerPresetIdFor(r.markers, q.markerPresets) || "all-blue";
          r.markers.forEach((m) => (m.placed ??= m.on));
          r.rotation ??= c.rotation;
          if (r.adjustment && !r.adjustment.mode)
            r.adjustment.mode = r.adjustment.levels ? "legacy" : "legacy";
          const source = c.merge || c.cl;
          if (source && !r.sourceCorners)
            r.sourceCorners = correctedRectSourceCorners(
              {
                x: r.x,
                y: r.y,
                width: q.gels.find((gel) => gel.id === r.gelId)?.width || q.cropW,
                height: r.h,
              },
              r.rotation,
              source.width,
              source.height,
            );
        });
      });
      q.version = 3;
      q.schemaVersion = 3;
      q.appVersion ??= legacyProject ? "legacy-import" : "0.3.0-local";
      setP(q);
      setActive(q.captures[0]?.id || "");
      setRegionId(q.captures[0]?.regions[0]?.id || "");
      setActiveGelId(q.captures[0]?.regions[0]?.gelId || q.gels[0]?.id || "");
      setViewAuto({});
      setQuantPreviews({});
      setNotice("プロジェクトを復元しました");
  }
  function projectNeedsImageRelink(project: Project) {
    return project.captures.some((capture) =>
      (["cl", "merge", "m"] as const).some(
        (role) => capture[role] && !capture[role]?.data,
      ),
    );
  }
  async function openProject(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const q = JSON.parse(await f.text()) as Project;
      if (![2, 3].includes(q.version)) throw new Error("unsupported project version");
      if (projectNeedsImageRelink(q)) {
        setPendingLinkedProject(q);
        setPendingProjectFileName(f.name);
        setNotice("軽量JSONを読み込みました。元画像フォルダを選択して再リンクしてください");
      } else {
        restoreParsedProject(q);
      }
    } catch {
      setNotice("このプロジェクトJSONは読み込めません");
    }
    e.target.value = "";
  }
  async function relinkProjectImages(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []).filter((file) =>
      /\.(tiff?|png|jpe?g)$/i.test(file.name),
    );
    if (!pendingLinkedProject || !selected.length) {
      e.target.value = "";
      return;
    }
    try {
      setNotice("元画像を照合してプロジェクトを復元しています…");
      const project = structuredClone(pendingLinkedProject);
      const cache = new Map<File, Promise<Img>>(),
        missing: string[] = [];
      for (const capture of project.captures) {
        for (const role of ["cl", "m", "merge"] as const) {
          const reference = capture[role];
          if (!reference || reference.data) continue;
          const file = chooseLinkedFile(reference, capture.folder, selected),
            derivedMerge =
              role === "merge" &&
              (reference.derivedFromRoles?.length ||
                /_working-merge\.png$/i.test(reference.name));
          if (!file) {
            if (!derivedMerge)
              missing.push(`${capture.key}: ${reference.relativePath || reference.name}`);
            continue;
          }
          if (!cache.has(file)) cache.set(file, readImage(file));
          capture[role] = await cache.get(file)!;
        }
        if (
          capture.merge &&
          !capture.merge.data &&
          capture.cl?.data &&
          capture.m?.data &&
          (capture.merge.derivedFromRoles?.length ||
            /_working-merge\.png$/i.test(capture.merge.name))
        ) {
          capture.merge = await createWorkingMerge(capture.cl, capture.m);
        }
      }
      if (missing.length) {
        setNotice(
          `元画像を${missing.length}件見つけられません。正しい親フォルダを選択してください（例: ${missing[0]}）`,
        );
        e.target.value = "";
        return;
      }
      await Promise.all(
        project.captures.flatMap((capture) => {
          const jobs: Promise<void>[] = [];
          if (capture.cl?.data && capture.levels) {
            jobs.push(
              adjustedData(capture.cl, capture.levels, capture.invert).then(
                (preview) => {
                  capture.clPreview = preview;
                },
              ),
            );
          }
          capture.regions.forEach((region) => {
            if (!capture.cl?.data || !region.adjustment) return;
            if (
              region.adjustment.mode === "minmax" &&
              region.adjustment.min !== undefined &&
              region.adjustment.max !== undefined
            ) {
              jobs.push(
                rawAdjustedData(capture.cl, {
                  min: region.adjustment.min,
                  max: region.adjustment.max,
                  bitDepth:
                    region.adjustment.bitDepth ||
                    capture.cl.bitsPerSample ||
                    8,
                  invert: region.adjustment.invert,
                }).then((preview) => {
                  region.adjustment!.preview = preview;
                }),
              );
              return;
            }
            if (!region.adjustment.levels) return;
            jobs.push(
              adjustedData(
                capture.cl,
                region.adjustment.levels,
                region.adjustment.invert,
              ).then((preview) => {
                region.adjustment!.preview = preview;
              }),
            );
          });
          return jobs;
        }),
      );
      restoreParsedProject(project);
      setPendingLinkedProject(null);
      setPendingProjectFileName("");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `元画像の再リンクに失敗しました: ${error.message}`
          : "元画像の再リンクに失敗しました",
      );
    }
    e.target.value = "";
  }
  return (
    <main className={compactUi ? "compactUi" : ""}>
      <header className="top">
        <div className="brand">
          <div className="brandTitle">
            <b>BlotCanvas</b>
            <span className="betaBadge">ベータ版</span>
          </div>
          <span>WB preparation workspace</span>
        </div>
        <label className="projectNameEditor">
          <span>プロジェクト名・保存名</span>
          <input
            className="projectName"
            value={p.name}
            placeholder="例：2026-08-17_AurA_WB"
            onChange={(e) => patch((x) => ((x.name = e.target.value), x))}
          />
        </label>
        <div className="actions">
          <a className="languageSwitch" href="./?lang=en">
            English
          </a>
          <a className="languageSwitch" href="./">
            日本語
          </a>
          <button
            onClick={() =>
              window.open(
                isEnglishUi() ? "./manual-en.html" : "./manual.html",
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            はじめての方へ
          </button>
          {!installed && installPrompt && (
            <button
              className="installButton"
              onClick={async () => {
                await installPrompt.prompt();
                const choice = await installPrompt.userChoice;
                if (choice.outcome === "accepted") setInstallPrompt(null);
              }}
            >
              アプリとして追加
            </button>
          )}
          <button onClick={() => projectFile.current?.click()}>開く</button>
          <button onClick={saveProject}>保存</button>
          <button
            className="primary"
            disabled={!allRegions.length}
            onClick={exportEditablePdf}
          >
            編集用PDF
          </button>
        </div>
      </header>
      <div className="privacyBar">
        <span>
          <b>端末内処理</b>
          選択した画像・プロジェクトはサーバーへ送信されません
        </span>
        <span className="roadmapNote">
          <b>実装予定</b>
          レーンプロファイル・ピーク積分
        </span>
        <span className="browserNote">
          <b>推奨ブラウザ</b>
          最新版 Chrome / Edge
        </span>
        <details>
          <summary>データの取り扱い</summary>
          <div>
            TIFFの読み込み、画像調整、Figure作成はこのブラウザ内で行います。元画像をBlotCanvasのサーバーへ保存・送信する機能はありません。プロジェクトJSONは画像本体を含まず、再開時に元画像フォルダを選んで再リンクします。公開版では、利用状況を把握するためCloudflare Web AnalyticsによるCookieを使わない匿名のページビュー統計を取得します。画像、プロジェクト内容、入力した条件は統計へ送信されません。出力ファイルはブラウザのダウンロード先へ保存されます。最新版のGoogle ChromeまたはMicrosoft Edgeを推奨します。Safariなどではファイル・フォルダ操作の挙動が異なる場合があります。
          </div>
        </details>
        <button
          className={`displayModeSwitch ${compactUi ? "isCompact" : ""}`}
          onClick={() => setCompactUi((value) => !value)}
          role="switch"
          aria-checked={compactUi}
          aria-label={
            compactUi
              ? "説明表示：コンパクト"
              : "説明表示：詳細"
          }
          title="補足説明の表示量を切り替えます"
        >
          <span className="displayModeCaption">説明表示</span>
          <span className={`displayModeLabel ${compactUi ? "" : "active"}`}>
            詳細
          </span>
          <span className="displayModeTrack" aria-hidden="true">
            <span className="displayModeKnob" />
          </span>
          <span className={`displayModeLabel ${compactUi ? "active" : ""}`}>
            コンパクト
          </span>
        </button>
        <button
          className="feedbackButton"
          onClick={() => {
            if (FEEDBACK_FORM_URL)
              window.open(FEEDBACK_FORM_URL, "_blank", "noopener,noreferrer");
            else
              setNotice(
                "不具合・改善報告フォームは準備中です。公開前に送信先を設定します。",
              );
          }}
        >
          不具合・改善を報告
        </button>
      </div>
      <input
        ref={projectFile}
        hidden
        type="file"
        accept=".json"
        onChange={openProject}
      />
      <input
        ref={relinkFolderFiles}
        hidden
        type="file"
        multiple
        accept=".tif,.tiff,.png,.jpg,.jpeg"
        {...{ webkitdirectory: "" }}
        onChange={relinkProjectImages}
      />
      <input
        ref={conditionFile}
        hidden
        type="file"
        accept=".json"
        onChange={openConditionSettings}
      />
      {notice && <div className="toast">{notice}</div>}
      {autosaveDraft && !pendingLinkedProject && (
        <div className="projectRelinkPrompt autosavePrompt" role="status">
          <div>
            <b>前回の自動保存があります</b>
            <span>
              {new Date(autosaveDraft.savedAt).toLocaleString()} · Step {autosaveDraft.step}
            </span>
            <span>
              画像を含まない作業設定を復元します。元画像フォルダは再選択してください。
            </span>
          </div>
          <button
            className="primary"
            onClick={() => {
              const draft = autosaveDraft;
              if (!draft) return;
              setAutosaveDraft(null);
              setStep(Math.max(1, Math.min(9, draft.step || 1)));
              if (projectNeedsImageRelink(draft.project)) {
                setPendingLinkedProject(draft.project);
                setPendingProjectFileName("ブラウザ内の自動保存");
                setNotice("元画像フォルダを選択すると前回の作業を復元できます");
              } else restoreParsedProject(draft.project);
            }}
          >
            前回の作業を復元
          </button>
          <button
            onClick={() => {
              localStorage.removeItem(AUTOSAVE_KEY);
              setAutosaveDraft(null);
              setNotice("自動保存した下書きを破棄しました");
            }}
          >
            破棄して新規開始
          </button>
        </div>
      )}
      {pendingLinkedProject && (
        <div className="projectRelinkPrompt" role="status">
          <div>
            <b>元画像の再リンクが必要です</b>
            <span>{pendingProjectFileName}</span>
            <span>
              このJSONの元画像を含むフォルダを選択してください。相対パスを優先し、見つからない場合はファイル名で照合します。
            </span>
          </div>
          <button
            className="primary"
            onClick={() => relinkFolderFiles.current?.click()}
          >
            元画像フォルダを選択して復元
          </button>
          <button
            onClick={() => {
              setPendingLinkedProject(null);
              setPendingProjectFileName("");
              setNotice("プロジェクトの復元をキャンセルしました");
            }}
          >
            キャンセル
          </button>
        </div>
      )}
      <div className="shell">
        <nav>
          {[
            "撮影セット",
            "水平補正",
            "領域指定",
            "Figure用輝度調整",
            "マーカー",
            "条件表",
            "構成・出力",
            "定量化",
            "グラフ",
          ]
            .slice(0, QUANTIFICATION_ENABLED ? 9 : 7)
            .map((s, i) => {
              const status = workflowStatus[i];
              return (
                <button
                  key={s}
                  className={step === i + 1 ? "active" : ""}
                  onClick={() => selectWorkflowStep(i + 1)}
                >
                  <i>
                    {i + 1}
                    {status.kind !== "none" && (
                      <em
                        className={`workflowBadge ${status.kind}`}
                        aria-label={status.title}
                        data-tooltip={status.title}
                        tabIndex={0}
                      >
                        {status.symbol}
                      </em>
                    )}
                  </i>
                  <span>{s}</span>
                </button>
              );
            })}
        </nav>
        <aside ref={asidePane}>
          <h2>
            {
              [
                "撮影ファイルをまとめる",
                "ゲルごとに水平線で合わせる",
                "ブロットごとの高さを決める",
                "Figure用画像の見え方を整える",
                "分子量マーカーを指定",
                "レーン条件を作る",
                "順番を決めて書き出す",
                "元画像からバンドを測定する",
                "定量結果をグラフにする",
              ][step - 1]
            }
          </h2>
          {step === 1 && (
            <>
              <p>撮影装置を選ぶと、装置に合った取り込み方法を表示します。</p>
              <div className="deviceChoice">
                <button
                  className={deviceMode === "atto" ? "selected" : ""}
                  onClick={() => setDeviceMode("atto")}
                >
                  <b>ATTO LuminoGraph</b>
                  <small>CL・Merge・Mを自動分類</small>
                </button>
                <button
                  className={deviceMode === "manual" ? "selected" : ""}
                  onClick={() => setDeviceMode("manual")}
                >
                  <b>その他の撮影装置</b>
                  <small>画像の役割を手動で選択</small>
                </button>
              </div>
              <label className="projectSetupName">
                <span>
                  <b>プロジェクト名／保存ファイル名</b>
                  <small>
                    JSON・Figure・Source recordの共通ファイル名になります
                  </small>
                </span>
                <input
                  value={p.name}
                  placeholder="例：2026-08-17_AurA_WB"
                  onChange={(event) =>
                    patch((project) => {
                      project.name = event.target.value;
                      return project;
                    })
                  }
                />
                <small>
                  未変更の場合、撮影フォルダ選択時にフォルダ名を自動入力します
                </small>
              </label>
              <p className="importHint">
                {deviceMode === "atto"
                  ? "日付_000X_CL／Mergeと000(X+1)_M、およびSum撮影の組み合わせを自動でまとめ、撮影番号順に並べます。露光設定用TIFFは無視します。"
                  : "TIFF・PNG・JPEGを読み込み、シグナル、Merge、明視野／マーカー画像を指定します。Mergeがない場合は、シグナルと明視野／マーカー画像から作業用Mergeを生成できます。"}
              </p>
              <button
                className="upload"
                onClick={() => folderFiles.current?.click()}
              >
                ＋ 撮影フォルダを選択
              </button>
              <button className="wide" onClick={() => files.current?.click()}>
                ファイルを個別選択
              </button>
              <input
                ref={folderFiles}
                hidden
                type="file"
                multiple
                accept=".tif,.tiff,.png,.jpg,.jpeg"
                {...{ webkitdirectory: "" }}
                onChange={importFiles}
              />
              <input
                ref={files}
                hidden
                type="file"
                multiple
                accept=".tif,.tiff,.png,.jpg,.jpeg"
                onChange={importFiles}
              />
              {deviceMode === "manual" && manualPool.length > 0 && (
                <div className="manualAssignment">
                  <h3>画像の役割を割り当てる</h3>
                  <label>
                    撮影セット名
                    <input
                      value={manualSetName}
                      onChange={(e) => setManualSetName(e.target.value)}
                    />
                  </label>
                  {(["cl", "merge", "m"] as const).map((role) => (
                    <label key={role}>
                      {role === "cl"
                        ? "シグナル／CL（必須）"
                        : role === "merge"
                          ? "Merge（任意）"
                          : "明視野／マーカー／M（任意）"}
                      <select
                        value={manualRoles[role]}
                        onChange={(e) =>
                          setManualRoles((old) => ({
                            ...old,
                            [role]: e.target.value,
                          }))
                        }
                      >
                        <option value="">{role === "cl" ? "選択してください" : "なし"}</option>
                        {manualPool.map((img, i) => (
                          <option key={`${img.relativePath || img.name}-${i}`} value={i}>
                            {img.relativePath || img.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                  <div className="roleStatus">
                    <span className={manualRoles.cl !== "" ? "ok" : "miss"}>CL {manualRoles.cl !== "" ? "あり" : "未選択"}</span>
                    <span className={manualRoles.merge !== "" ? "ok" : "optional"}>Merge {manualRoles.merge !== "" ? "あり" : "なし"}</span>
                    <span className={manualRoles.m !== "" ? "ok" : "optional"}>M {manualRoles.m !== "" ? "あり" : "なし"}</span>
                  </div>
                  {manualRoles.merge === "" && manualRoles.m !== "" && (
                    <div className="workingMergeBuilder">
                      <b>装置がMerge画像を作らない場合</b>
                      <p>
                        シグナル画像と明視野／マーカー画像を重ね、水平補正・領域指定・マーカー確認に使う作業用Mergeを生成します。元画像と定量用画像は変更しません。
                      </p>
                      <button type="button" onClick={generateManualMerge}>
                        {manualGeneratedMerge ? "作業用Mergeを再生成" : "作業用Mergeを生成・確認"}
                      </button>
                      {manualGeneratedMerge && (
                        <figure>
                          <img src={manualGeneratedMerge.data} alt="生成した作業用Merge" />
                          <figcaption>生成した作業用Merge（プロジェクト内に保存）</figcaption>
                        </figure>
                      )}
                    </div>
                  )}
                  <button
                    className="primary wide"
                    disabled={manualRoles.cl === ""}
                    onClick={addManualCapture}
                  >
                    この組み合わせを撮影セットに追加
                  </button>
                  <p>別の組み合わせを続けて作る場合は、選択を変更してもう一度追加します。</p>
                </div>
              )}
              <div className="reuseSettings">
                <b>前回の設定を再利用</b>
                <p>
                  条件表、レーン数、文字設定、登録マーカーを読み込みます。撮影ごとに変わる水平補正、切り出し枠、輝度、マーカー位置は読み込みません。
                </p>
                <button onClick={() => conditionFile.current?.click()}>
                  設定テンプレートJSONを読み込む
                </button>
              </div>
              <h3>ゲル／最終パネル</h3>
              <div className="gelSetup">
                {p.gels.map((g, i) => (
                  <div key={g.id}>
                    <input
                      value={g.name}
                      onChange={(e) =>
                        patch((x) => {
                          x.gels[i].name = e.target.value;
                          return x;
                        })
                      }
                    />
                    <span>幅 {g.width.toFixed(1)}%</span>
                    {p.gels.length > 1 && (
                      <button
                        onClick={() =>
                          patch((x) => {
                            x.gels = x.gels.filter((v) => v.id !== g.id);
                            x.captures.forEach((c) => {
                              c.assignedGelIds = c.assignedGelIds?.filter(
                                (id) => id !== g.id,
                              );
                              c.regions
                                .filter((r) => r.gelId === g.id)
                                .forEach((r) => (r.gelId = x.gels[0].id));
                            });
                            return x;
                          })
                        }
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={addGel}>＋ ゲルを追加</button>
              <div className="captureList">
                {p.captures.map((c) => (
                  <button
                    className={cap?.id === c.id ? "selected" : ""}
                    onClick={() => setActive(c.id)}
                    key={`${c.folder}/${c.key}`}
                  >
                    <b>{c.key}</b>
                    <span className={c.cl ? "ok" : "miss"}>CL</span>
                    <span className={c.merge ? "ok" : "miss"}>Merge</span>
                    <span className={c.m ? "ok" : "miss"}>M</span>
                    {c.folder && <small>{c.folder}</small>}
                    {c.antibodies.length > 0 && (
                      <em>{c.antibodies.join(" · ")}</em>
                    )}
                  </button>
                ))}
              </div>
              {!!p.captures.length && (
                <details className="captureCleanup">
                  <summary>読み込んだファイルを整理・除外</summary>
                  <p>
                    誤って取り込まれた画像だけ、または撮影セット全体をプロジェクトから外せます。ディスク上の元ファイルは削除しません。
                  </p>
                  {p.captures.map((capture) => (
                    <div className="captureCleanupRow" key={capture.id}>
                      <div>
                        <b>{capture.key}</b>
                        {capture.folder && <small>{capture.folder}</small>}
                      </div>
                      <div className="captureCleanupFiles">
                        {(["cl", "merge", "m"] as const).map((role) =>
                          capture[role] ? (
                            <button
                              key={role}
                              type="button"
                              title={capture[role]?.name}
                              onClick={() => excludeCaptureImage(capture.id, role)}
                            >
                              {role === "cl" ? "CL" : role === "merge" ? "Merge" : "M"} ×
                            </button>
                          ) : null,
                        )}
                      </div>
                      <button
                        type="button"
                        className="dangerText"
                        onClick={() => excludeCapture(capture.id)}
                      >
                        セットを除外
                      </button>
                    </div>
                  ))}
                </details>
              )}
              {!!p.captures.length && (
                <div className="antibodyEditor antibodyMatrix">
                  <h3>撮影ごとの抗体名</h3>
                  <p>全撮影をここでまとめて確認・修正できます。</p>
                  {p.captures.map((c) => (
                    <label key={c.id}>
                      <span>{c.key}</span>
                      <input
                        value={antibodyDrafts[c.id] ?? c.antibodies.join(", ")}
                        placeholder="例：GFP, GAPDH"
                        onFocus={(e) => {
                          const currentValue = e.currentTarget.value;
                          setActive(c.id);
                          setAntibodyDrafts((old) => ({
                            ...old,
                            [c.id]: old[c.id] ?? currentValue,
                          }));
                        }}
                        onChange={(e) =>
                          setAntibodyDrafts((old) => ({
                            ...old,
                            [c.id]: e.target.value,
                          }))
                        }
                        onBlur={(e) => {
                          patchCap(c.id, {
                            antibodies: e.target.value
                              .split(/[,，、]+/)
                              .map((s) => s.trim())
                              .filter(Boolean),
                          });
                          setAntibodyDrafts((old) => {
                            const next = { ...old };
                            delete next[c.id];
                            return next;
                          });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                      />
                    </label>
                  ))}
                </div>
              )}
            </>
          )}
          {step === 2 && cap && (
            <>
              <p>
                撮影×ゲルごとに、基準にするマーカーバンドを1点クリックします。その位置へ水平線が移動するので、右側の角度スライダーでバンドと線を平行にしてください。
              </p>
              <div className="selectedCapture">
                <b>{cap.key} · {p.gels.find((g) => g.id === activeGelId)?.name || "Gel"}</b>
                <span>{stepTargetIndex + 1} / {stepTargets.length}</span>
              </div>
              <div className="targetNavigator"><button onClick={() => navigateStepTarget(-1)}>← 前へ</button><button onClick={() => navigateStepTarget(1)}>次へ →</button></div>
            </>
          )}
          {step === 3 && cap && (
            <>
              <p className="hint">
                横幅は割り当てたゲル内だけ、高さは同じ抗体の領域だけ同期します。位置は各枠で独立です。
              </p>
              <div className="selectedCapture">
                <b>{cap.key} · {p.gels.find((g) => g.id === (region?.gelId || activeGelId))?.name || "Gel"}</b>
                <span>{stepTargetIndex + 1} / {stepTargets.length}</span>
              </div>
              <div className="targetNavigator"><button onClick={() => navigateStepTarget(-1)}>← 前へ</button><button onClick={() => navigateStepTarget(1)}>次へ →</button></div>
              <button onClick={addRegion}>＋ 選択中の撮影に領域を追加</button>
              {cap.regions.map((r) => (
                <div
                  className={`regionCard ${region?.id === r.id ? "selected" : ""} ${r.needsReview ? "needsReview" : ""}`}
                  key={r.id}
                  onClick={() => setRegionId(r.id)}
                >
                  <input
                    value={r.name}
                    onChange={(e) =>
                      patchRegion(cap.id, r.id, { name: e.target.value })
                    }
                  />
                  {r.needsReview && (
                    <small className="reviewNotice">回転変更後：枠・マーカー位置を確認してください</small>
                  )}
                  <small className="syncState">
                    横幅：{p.gels.find((g) => g.id === r.gelId)?.name}で同期 · 高さ：{r.antibody || "抗体未入力"}で同期
                  </small>
                  <label>
                    ゲル／パネル
                    <select
                      value={r.gelId}
                      onChange={(e) =>
                        patchRegion(cap.id, r.id, {
                          gelId: e.target.value,
                          x: Math.min(r.x, 100 - gelWidth(e.target.value)),
                          rotation:
                            cap.gelRotations?.[e.target.value] ?? cap.rotation,
                        })
                      }
                    >
                      {p.gels.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    抗体名（候補から選択／直接入力）
                    <input
                      value={r.antibody}
                      list="antibodies"
                      onChange={(e) =>
                        patchRegion(cap.id, r.id, { antibody: e.target.value })
                      }
                    />
                    <datalist id="antibodies">
                      {[
                        ...new Set(p.captures.flatMap((c) => c.antibodies)),
                      ].map((a) => (
                        <option key={a} value={a} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    {p.gels.find((g) => g.id === r.gelId)?.name}の共通横幅{" "}
                    <output>{gelWidth(r.gelId).toFixed(1)}%</output>
                    <input
                      type="range"
                      min="15"
                      max="98"
                      step=".2"
                      value={gelWidth(r.gelId)}
                      onChange={(e) => setGelWidth(r.gelId, +e.target.value)}
                    />
                  </label>
                  <label>
                    左 {r.x.toFixed(1)}%
                    <input
                      type="range"
                      min="0"
                      max={100 - gelWidth(r.gelId)}
                      step=".2"
                      value={r.x}
                      onChange={(e) =>
                        patchRegion(cap.id, r.id, { x: +e.target.value })
                      }
                    />
                  </label>
                  <label>
                    上 {r.y.toFixed(1)}%
                    <input
                      type="range"
                      min="0"
                      max={100 - r.h}
                      step=".2"
                      value={r.y}
                      onChange={(e) =>
                        patchRegion(cap.id, r.id, { y: +e.target.value })
                      }
                    />
                  </label>
                  <label>
                    {r.antibody}の共通高さ {r.h.toFixed(1)}%
                    <input
                      type="range"
                      min="3"
                      max={100 - r.y}
                      step=".2"
                      value={r.h}
                      onChange={(e) =>
                        setRegionHeight(cap.id, r.id, +e.target.value)
                      }
                    />
                  </label>
                  {(cap.merge || cap.m) && (
                    <>
                      <div
                        className="miniLevelPreview"
                        style={{
                          aspectRatio: `${((cap.merge || cap.m)!.width * gelWidth(r.gelId)) / 100 / (((cap.merge || cap.m)!.height * r.h) / 100)}`,
                        }}
                      >
                        <img
                          src={
                            viewAuto[
                              `${cap.id}:${cap.merge ? "merge" : "m"}`
                            ] || (cap.merge || cap.m)!.data
                          }
                          style={{
                            width: `${10000 / gelWidth(r.gelId)}%`,
                            height: `${10000 / r.h}%`,
                            left: `${(-r.x * 100) / gelWidth(r.gelId)}%`,
                            top: `${(-r.y * 100) / r.h}%`,
                            transform: `rotate(${r.rotation ?? cap.rotation}deg)`,
                          }}
                        />
                        <i />
                      </div>
                      <label>
                        メンブレンの水平微調整{" "}
                        <output>
                          {(r.rotation ?? cap.rotation).toFixed(2)}°
                        </output>
                        <input
                          type="range"
                          min="-5"
                          max="5"
                          step=".05"
                          value={r.rotation ?? cap.rotation}
                          onChange={(e) =>
                            setGelRotation(cap.id, r.gelId, +e.target.value)
                          }
                        />
                      </label>
                    </>
                  )}
                  <button
                    className="danger"
                    onClick={() => removeRegion(cap.id, r.id)}
                  >
                    削除
                  </button>
                </div>
              ))}
            </>
          )}
          {step === 4 && cap && (
            <>
              <p>
                Figure表示は元画素値のMin / Maxを直線変換します。Autoは選択枠の分布を解析し、同じ抗体名・同じbit深度へ共有します。
              </p>
              <div className="selectedCapture">
                <b>{region?.antibody || "領域を選択"}</b>
                <span>{cap.key} · {stepTargetIndex + 1} / {stepTargets.length}</span>
              </div>
              <div className="targetNavigator"><button onClick={() => navigateStepTarget(-1)}>← 前へ</button><button onClick={() => navigateStepTarget(1)}>次へ →</button></div>
              <button
                className="auto"
                disabled={!cap.cl || !region}
                onClick={() => region && autoClFor(cap, region)}
              >
                {adjustmentBusy === region?.id ? "解析中…" : "◐ この切出し領域をAuto"}
              </button>
              <button
                disabled={!region}
                onClick={() => region && resetAntibodyAdjustment(region.antibody)}
              >
                輝度調整をReset
              </button>
              {region?.adjustment?.mode === "legacy" ||
              (region?.adjustment?.levels && region.adjustment.mode !== "minmax") ? (
                <p className="levels legacyLevels">
                  旧方式の輝度設定を維持中 · AutoまたはMin / Max操作で新方式へ変換
                </p>
              ) : region?.adjustment?.mode === "minmax" ? (
                <p className="levels">
                  Min {region.adjustment.min} ／ Max {region.adjustment.max}{" "}
                  <b>{region.adjustment.bitDepth}-bit元画素値</b>
                </p>
              ) : null}
              {region && cap.cl && (
                <label>
                  Min（黒側） {region.adjustment?.min ?? 0}
                  <input
                    type="range"
                    min="0"
                    max={2 ** (cap.cl.bitsPerSample || 8) - 2}
                    step={cap.cl.bitsPerSample === 16 ? 16 : 1}
                    value={region.adjustment?.min ?? 0}
                    onChange={(e) =>
                      void applyRawRange(cap, region, {
                        min: +e.target.value,
                        max:
                          region.adjustment?.max ??
                          2 ** (cap.cl!.bitsPerSample || 8) - 1,
                        bitDepth: cap.cl!.bitsPerSample || 8,
                        invert: region.adjustment?.invert ?? cap.invert,
                      })
                    }
                  />
                </label>
              )}
              {region && cap.cl && (
                <label>
                  Max（白側） {region.adjustment?.max ?? 2 ** (cap.cl.bitsPerSample || 8) - 1}
                  <input
                    type="range"
                    min="1"
                    max={2 ** (cap.cl.bitsPerSample || 8) - 1}
                    step={cap.cl.bitsPerSample === 16 ? 16 : 1}
                    value={region.adjustment?.max ?? 2 ** (cap.cl.bitsPerSample || 8) - 1}
                    onChange={(e) =>
                      void applyRawRange(cap, region, {
                        min: region.adjustment?.min ?? 0,
                        max: +e.target.value,
                        bitDepth: cap.cl!.bitsPerSample || 8,
                        invert: region.adjustment?.invert ?? cap.invert,
                      })
                    }
                  />
                </label>
              )}
              {region && cap.cl && (
                <>
                  <label className="mini adjustmentLinkToggle">
                    <input
                      type="checkbox"
                      checked={region.adjustment?.linked !== false}
                      onChange={(event) =>
                        patchRegion(cap.id, region.id, {
                          adjustment: {
                            ...(region.adjustment || {
                              brightness: 100,
                              contrast: 100,
                              invert: cap.invert,
                            }),
                            linked: event.target.checked,
                          },
                        })
                      }
                    />
                    同じ抗体名・bit深度と調整を共有
                  </label>
                  <label className="mini">
                    <input
                      type="checkbox"
                      checked={region.adjustment?.invert ?? cap.invert}
                      onChange={(event) =>
                        void applyRawRange(cap, region, {
                          min: region.adjustment?.min ?? 0,
                          max: region.adjustment?.max ?? 2 ** (cap.cl!.bitsPerSample || 8) - 1,
                          bitDepth: cap.cl!.bitsPerSample || 8,
                          invert: event.target.checked,
                        })
                      }
                    />
                    白黒反転
                  </label>
                  {region.adjustment?.mode === "minmax" && (
                    <details className="histogramDetails">
                      <summary>階調情報・クリップ率</summary>
                      <p>
                        黒側 {region.adjustment.clippedLowPercent?.toFixed(2) || "0.00"}% · 白側 {region.adjustment.clippedHighPercent?.toFixed(2) || "0.00"}% · 元画像飽和 {region.adjustment.sourceSaturatedPercent?.toFixed(3) || "0.000"}%
                      </p>
                    </details>
                  )}
                </>
              )}
            </>
          )}
          {step === 5 && cap && region && (
            <>
              <p>
                赤枠ごとに表示する分子量を複数選び、M全体画像を上から順にクリックします。選んだ分子量が大きい順に配置されます。
              </p>
              <fieldset className="markerStateChooser">
                <legend>このGelの分子量表示</legend>
                {(["configured", "none"] as const).map((state) => (
                  <label key={state}>
                    <input
                      type="radio"
                      name={`marker-state-${region.gelId}`}
                      checked={
                        (p.gels.find((gel) => gel.id === region.gelId)?.markerState ||
                          "unconfirmed") === state
                      }
                      onChange={() =>
                        patch((project) => {
                          const gel = project.gels.find(
                            (item) => item.id === region.gelId,
                          );
                          if (gel) gel.markerState = state;
                          return project;
                        })
                      }
                    />
                    {state === "configured"
                      ? "マーカーを設定する"
                      : "このFigureではマーカーを表示しない"}
                  </label>
                ))}
                {(p.gels.find((gel) => gel.id === region.gelId)?.markerState ||
                  "unconfirmed") === "unconfirmed" && (
                  <strong className="markerUnconfirmed">未確認</strong>
                )}
              </fieldset>
              {p.gels.find((gel) => gel.id === region.gelId)?.markerState !==
                "none" && <label>
                マーカー種類
                <select
                  value={activeMarkerPreset}
                  onChange={(e) => selectMarkerPreset(e.target.value)}
                >
                  {[...p.markerPresets]
                    .sort(
                      (a, b) =>
                        (b.lastUsedAt || 0) - (a.lastUsedAt || 0) ||
                        a.name.localeCompare(b.name),
                    )
                    .map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.lastUsedAt ? "最近使用 · " : ""}
                        {preset.name}
                      </option>
                    ))}
                </select>
              </label>}
              <p className="hint markerStorageHint">
                種類を選ぶと分子量一覧へすぐ反映されます。選んだ種類と自作プリセットはこのブラウザに保存され、プロジェクトJSONにも含まれます。
              </p>
              <label className="mini markerReuse">
                <input
                  type="checkbox"
                  checked={reuseMarkerSelection}
                  onChange={(e) => setReuseMarkerSelection(e.target.checked)}
                />
                このブロットシリーズで選択を共通化
              </label>
              <button onClick={() => applyMarkerPreset()}>
                選択中の種類を再適用
              </button>
              <details className="markerPresetEditor">
                <summary>＋ 手持ちのマーカーを新規登録</summary>
                <input
                  value={newMarkerPreset.name}
                  placeholder="製品名"
                  onChange={(e) =>
                    setNewMarkerPreset((old) => ({
                      ...old,
                      name: e.target.value,
                    }))
                  }
                />
                <input
                  value={newMarkerPreset.values}
                  placeholder="250, 150, 100, 75, 50..."
                  onChange={(e) =>
                    setNewMarkerPreset((old) => ({
                      ...old,
                      values: e.target.value,
                    }))
                  }
                />
                <button onClick={registerMarkerPreset}>登録</button>
                {!p.markerPresets.find(
                  (preset) => preset.id === activeMarkerPreset,
                )?.builtIn && (
                  <button className="dangerText" onClick={removeMarkerPreset}>
                    選択中の自作プリセットを削除
                  </button>
                )}
              </details>
              <div className="selectedCapture">
                <b>{region.name}</b>
                <span>
                  {cap.key} · {p.gels.find((g) => g.id === region.gelId)?.name}
                </span>
              </div>
              <p className="markerNext">
                次に配置：
                {region.markers.filter((m) => m.on).sort((a, b) => b.mw - a.mw)[
                  markerStep[region.id] || 0
                ]?.mw ?? "完了"}{" "}
                kDa
              </p>
              {region.markers.map((m) => (
                <div className="markerCtl" key={m.mw}>
                  <label>
                    <input
                      type="checkbox"
                      checked={m.on}
                      onChange={(e) =>
                        setMarkerSelected(cap, region, m.mw, e.target.checked)
                      }
                    />
                    {m.mw} kDa
                  </label>
                  <span>{m.placed ? `${m.y.toFixed(1)}%` : "未配置"}</span>
                </div>
              ))}
              <button
                onClick={() => {
                  const a = structuredClone(region.markers);
                  a.forEach((m) => (m.placed = false));
                  patchRegion(cap.id, region.id, { markers: a });
                  setMarkerStep((old) => ({ ...old, [region.id]: 0 }));
                }}
              >
                このメンブレンの配置をリセット
              </button>
            </>
          )}
          {step === 6 && (
            <>
              <p>
                Excelと同じ感覚で条件を入力します。複数セルのコピー＆ペースト、範囲選択、セル結合に対応しています。
              </p>
              <div className="conditionHistoryToolbar">
                <button type="button" disabled={!conditionHistory.length} onClick={undoConditionEdit}>
                  ↶ 元に戻す
                </button>
                <button type="button" disabled={!conditionFuture.length} onClick={redoConditionEdit}>
                  ↷ やり直す
                </button>
                <button type="button" onClick={() => void copyConditionToolbar()}>
                  コピー
                </button>
                <button type="button" onClick={() => void pasteConditionToolbar()}>
                  貼り付け
                </button>
                <span>⌘/Ctrl+C、⌘/Ctrl+V、Tab、Shift+クリックが使えます</span>
              </div>
              <details className="conditionInputExample">
                <summary>入力例を見る</summary>
                <pre>{`Construct\tnone\tnone\tWT\tWT\nDrug\t−\t＋\t−\t＋`}</pre>
                <button
                  type="button"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText("Construct\tnone\tnone\tWT\tWT\nDrug\t−\t＋\t−\t＋")
                      .then(() => setNotice("入力例をクリップボードへコピーしました"))
                      .catch(() => setNotice("⌘/Ctrl+Cで例をコピーしてください"))
                  }
                >
                  例をコピー
                </button>
              </details>
              <div className="row">
                <button onClick={saveConditionSettings}>設定テンプレートを保存</button>
                <button onClick={() => conditionFile.current?.click()}>
                  設定テンプレートを読込
                </button>
                {p.gels.length > 1 && (
                  <button onClick={() => copyGelConditionsToAll(p.gels[0].id)}>
                    Gel 1の表を他の全Gelへコピー
                  </button>
                )}
              </div>
              {p.gels.map((g, gelIndex) => (
                <div className="gelConditions" key={g.id}>
                  <h3>{g.name}</h3>
                  {gelIndex > 0 && p.gels[0] && (
                    <button
                      className="copyGelConditions"
                      onClick={() => copyGelConditions(p.gels[0].id, g.id)}
                    >
                      Gel 1の条件表をこのゲルへコピー
                    </button>
                  )}
                  <label>
                    レーン数（数字を直接入力）
                    <input
                      className="laneNumberInput"
                      type="number"
                      min="0"
                      max="40"
                      value={g.lanes || ""}
                      placeholder="未入力"
                      onFocus={conditionCheckpoint}
                      onChange={(e) => lanes(g.id, e.target.value === "" ? 0 : +e.target.value)}
                    />
                  </label>
                  <div className="laneLayoutSettings">
                    <div className="laneLayoutTitle">
                      <b>レーンラベルの位置</b>
                      <small>Figure previewを見ながら画像のレーンへ合わせます</small>
                    </div>
                  <label className="laneGeometry">
                    ラベル列の中心
                    <small>通常は50%のままで構いません</small>
                    <input
                      className="inlineNumber"
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={g.laneCenter}
                      onChange={(e) =>
                        patch((x) => {
                          x.gels.find((v) => v.id === g.id)!.laneCenter =
                            +e.target.value;
                          return x;
                        })
                      }
                    />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step=".5"
                      value={g.laneCenter}
                      onChange={(e) =>
                        patch((x) => {
                          x.gels.find((v) => v.id === g.id)!.laneCenter =
                            +e.target.value;
                          return x;
                        })
                      }
                    />
                  </label>
                  <label className="laneGeometry">
                    ラベル列全体の幅
                    <small>切り出し画像の幅に合わない場合だけ調整します</small>
                    <input
                      className="inlineNumber"
                      type="number"
                      min="20"
                      max="200"
                      step="1"
                      value={g.laneSpan}
                      onChange={(e) =>
                        patch((x) => {
                          x.gels.find((v) => v.id === g.id)!.laneSpan =
                            +e.target.value;
                          return x;
                        })
                      }
                    />
                    <input
                      type="range"
                      min="20"
                      max="200"
                      step="1"
                      value={g.laneSpan}
                      onChange={(e) =>
                        patch((x) => {
                          x.gels.find((v) => v.id === g.id)!.laneSpan =
                            +e.target.value;
                          return x;
                        })
                      }
                    />
                  </label>
                  </div>
                  {conditionEditMode === "template" ? (
                    <>
                  <div className="templateIntro">
                    <b>条件の並び方を選ぶ</b>
                    <span>選択後も、生成された表はすべて編集できます</span>
                  </div>
                  <details className="pairTemplate templateCard simpleLaneTemplate">
                    <summary>
                      <span><b>各レーンに個別ラベル</b><small>繰り返しや階層のない単純な並び</small></span>
                      <span className="conditionExample simple"><em>Control　A　B　C</em></span>
                    </summary>
                    <label>
                      項目名
                      <input
                        value={simpleTemplate[g.id]?.label ?? "Sample"}
                        placeholder="例：Sample"
                        onChange={(event) =>
                          setSimpleTemplate((old) => ({
                            ...old,
                            [g.id]: {
                              label: event.target.value,
                              values:
                                old[g.id]?.values ??
                                "Control, Sample 1, Sample 2, Sample 3",
                            },
                          }))
                        }
                      />
                    </label>
                    <label>
                      左から順にレーンラベル（カンマ区切り）
                      <input
                        value={
                          simpleTemplate[g.id]?.values ??
                          "Control, Sample 1, Sample 2, Sample 3"
                        }
                        placeholder="例：Control, Sample 1, Sample 2"
                        onChange={(event) =>
                          setSimpleTemplate((old) => ({
                            ...old,
                            [g.id]: {
                              label: old[g.id]?.label ?? "Sample",
                              values: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <button onClick={() => applySimpleTemplate(g.id)}>
                      この方式で下書きを作る
                    </button>
                  </details>
                  <details className="pairTemplate templateCard">
                    <summary>
                      <span><b>繰り返し条件</b><small>各グループ内で同じ条件を繰り返す</small></span>
                      <span className="conditionExample repeated">
                        <i>none</i><i>WT</i>
                        <em><span>−　＋</span><span>−　＋</span></em>
                      </span>
                    </summary>
                    <label>
                      上段のグループ名（カンマ区切り）
                      <input
                        value={pairTemplate[g.id]?.expressions ?? "none, WT"}
                        placeholder="例：none, WT, mutant"
                        onChange={(e) =>
                          setPairTemplate((old) => ({
                            ...old,
                            [g.id]: {
                              ...old[g.id],
                              expressions: e.target.value,
                              pair: old[g.id]?.pair ?? "−, ＋",
                            },
                          }))
                        }
                      />
                    </label>
                    <label>
                      各グループで繰り返す条件（2つ）
                      <input
                        value={pairTemplate[g.id]?.pair ?? "−, ＋"}
                        placeholder="−, ＋"
                        onChange={(e) =>
                          setPairTemplate((old) => ({
                            ...old,
                            [g.id]: {
                              ...old[g.id],
                              expressions: old[g.id]?.expressions ?? "none, WT",
                              pair: e.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <div className="row">
                      <label>上段の項目名<input value={pairTemplate[g.id]?.groupLabel ?? "Expression"} onChange={(e) => setPairTemplate((old) => ({...old, [g.id]: {...old[g.id], expressions: old[g.id]?.expressions ?? "none, WT", pair: old[g.id]?.pair ?? "−, ＋", groupLabel: e.target.value}}))}/></label>
                      <label>下段の項目名<input value={pairTemplate[g.id]?.pairLabel ?? "Condition"} onChange={(e) => setPairTemplate((old) => ({...old, [g.id]: {...old[g.id], expressions: old[g.id]?.expressions ?? "none, WT", pair: old[g.id]?.pair ?? "−, ＋", pairLabel: e.target.value}}))}/></label>
                    </div>
                    <button onClick={() => applyPairTemplate(g.id)}>
                      この方式で下書きを作る
                    </button>
                  </details>
                  <details className="pairTemplate templateCard">
                    <summary>
                      <span><b>階層条件</b><small>一部のレーンを共通名でまとめる</small></span>
                      <span className="conditionExample hierarchy multiGroup"><i className="ungrouped"></i><i>Gene A</i><i>Gene B</i><em>NC　 #1 #2　 #1 #2</em></span>
                    </summary>
                    <p className="templateHelp">上位ラベルのない対照群と、1つ以上の標的グループを組み合わせられます。</p>
                    <label>
                      上段の標的名（複数の場合はカンマ区切り）
                      <input
                        value={sirnaTemplate[g.id]?.target ?? "Gene A, Gene B"}
                        placeholder="例：Gene A, Gene B"
                        onChange={(e) =>
                          setSirnaTemplate((old) => ({
                            ...old,
                            [g.id]: {
                              target: e.target.value,
                              negative:
                                old[g.id]?.negative ?? "NC",
                              sequences: old[g.id]?.sequences ?? "#1, #2, #3",
                            },
                          }))
                        }
                      />
                    </label>
                    <label>
                      ネガティブコントロール名
                      <input
                        value={
                          sirnaTemplate[g.id]?.negative ?? "NC"
                        }
                        onChange={(e) =>
                          setSirnaTemplate((old) => ({
                            ...old,
                            [g.id]: {
                              target: old[g.id]?.target ?? "Gene A, Gene B",
                              negative: e.target.value,
                              sequences: old[g.id]?.sequences ?? "#1, #2, #3",
                            },
                          }))
                        }
                      />
                    </label>
                    <label>
                      配列名（カンマ区切り）
                      <input
                        value={sirnaTemplate[g.id]?.sequences ?? "#1, #2, #3"}
                        onChange={(e) =>
                          setSirnaTemplate((old) => ({
                            ...old,
                            [g.id]: {
                              target: old[g.id]?.target ?? "Gene A, Gene B",
                              negative:
                                old[g.id]?.negative ?? "NC",
                              sequences: e.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <button onClick={() => applySirnaTemplate(g.id)}>
                      この方式で下書きを作る
                    </button>
                  </details>
                  <div className="templateCard simpleTemplate">
                    <div><b>交互条件を追加</b><small>薬剤、光、刺激などの − / ＋ を交互に配置</small></div>
                    <div className="plusMinusAdder">
                      <input
                        value={plusMinusName[g.id] ?? ""}
                        placeholder="項目名（例：Drug、Light）"
                        onChange={(e) =>
                          setPlusMinusName((old) => ({
                            ...old,
                            [g.id]: e.target.value,
                          }))
                        }
                      />
                      <button onClick={() => addPlusMinusCondition(g.id)}>
                        − / ＋ 行を追加
                      </button>
                    </div>
                  </div>
                  <p className="conditionEditorMovedNote">
                    下書き後に自由編集へ切り替えると、右側のExcel型エディタで調整できます。
                  </p>
                    </>
                  ) : (
                    <div className="freeEditGuide">
                      <b>右側の「表を編集」を使用します</b>
                      <span>
                        セル入力、結合・解除、条件行の追加・削除・並べ替えを広い画面で行えます。
                      </span>
                    </div>
                  )}
                  <details className="advancedConditionEditor legacyConditionEditor">
                    <summary>自由表エディタ（セル結合対応）</summary>
                  <div className="conditionTable">
                    {g.conditions.map((row, rowIndex) => (
                      <div className="condition" key={row.id}>
                        <div className="conditionHeader">
                          <input
                            className="condName"
                            aria-label="条件名"
                            value={row.name}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              updateConditionRow(g.id, row.id, (target) => {
                                target.name = value;
                              });
                            }}
                          />
                          <div className="conditionOrderButtons" aria-label="条件行の順序">
                            <button type="button" title="1つ上へ移動" disabled={rowIndex === 0} onClick={() => patch((project) => {
                              const conditions = project.gels.find((item) => item.id === g.id)!.conditions;
                              [conditions[rowIndex - 1], conditions[rowIndex]] = [conditions[rowIndex], conditions[rowIndex - 1]];
                              return project;
                            })}>↑</button>
                            <button type="button" title="1つ下へ移動" disabled={rowIndex === g.conditions.length - 1} onClick={() => patch((project) => {
                              const conditions = project.gels.find((item) => item.id === g.id)!.conditions;
                              [conditions[rowIndex], conditions[rowIndex + 1]] = [conditions[rowIndex + 1], conditions[rowIndex]];
                              return project;
                            })}>↓</button>
                          </div>
                          <button
                            className="danger"
                            title="この条件行を削除"
                            onClick={() =>
                              patch((x) => {
                                const gel = x.gels.find((v) => v.id === g.id)!;
                                gel.conditions = gel.conditions.filter((v) => v.id !== row.id);
                                return x;
                              })
                            }
                          >
                            削除
                          </button>
                        </div>
                        <div
                          className="cells spreadsheetCells"
                          style={{
                            gridTemplateColumns: `repeat(${g.lanes}, minmax(34px, 1fr))`,
                          }}
                        >
                          {(row.groups?.length
                            ? [...row.groups].sort((a, b) => a.start - b.start)
                            : row.values.map((label, start) => ({
                                label,
                                start,
                                span: 1,
                              }))
                          ).map((cell) => {
                            const selected =
                              conditionCellSelection?.gelId === g.id &&
                              conditionCellSelection.rowId === row.id &&
                              cell.start <= conditionCellSelection.end &&
                              cell.start + cell.span - 1 >=
                                conditionCellSelection.start;
                            return (
                              <label
                                className={`spreadsheetCell ${selected ? "selected" : ""} ${cell.span > 1 ? "merged" : ""}`}
                                style={{
                                  gridColumn: `${cell.start + 1} / span ${cell.span}`,
                                }}
                                key={`${cell.start}-${cell.span}`}
                              >
                                <small>
                                  {cell.span > 1
                                    ? `Lane ${cell.start + 1}–${cell.start + cell.span}`
                                    : `Lane ${cell.start + 1}`}
                                </small>
                                <input
                                  value={cell.label}
                                  placeholder={`${cell.start + 1}`}
                                  onPointerDown={(event) =>
                                    selectConditionCell(
                                      g.id,
                                      row.id,
                                      cell.start,
                                      cell.start + cell.span - 1,
                                      event.shiftKey,
                                    )
                                  }
                                  onChange={(event) => {
                                    const value = event.currentTarget.value;
                                    updateConditionRow(g.id, row.id, (target) => {
                                      if (target.groups?.length) {
                                        const group = target.groups.find(
                                          (item) =>
                                            item.start === cell.start &&
                                            item.span === cell.span,
                                        );
                                        if (group) group.label = value;
                                      } else target.values[cell.start] = value;
                                    });
                                  }}
                                />
                              </label>
                            );
                          })}
                        </div>
                        <div className="spreadsheetToolbar">
                          <span>
                            セルをクリック、Shift＋クリックで範囲選択
                          </span>
                          <button
                            type="button"
                            onClick={() => mergeConditionCells(g.id, row.id)}
                          >
                            選択セルを結合
                          </button>
                          <button
                            type="button"
                            onClick={() => unmergeConditionCells(g.id, row.id)}
                          >
                            結合を解除
                          </button>
                        </div>
                        <label className="mini">
                          <input
                            type="checkbox"
                            checked={row.visible}
                            onChange={(e) =>
                              patch((x) => {
                                x.gels
                                  .find((z) => z.id === g.id)!
                                  .conditions.find(
                                    (z) => z.id === row.id,
                                  )!.visible = e.target.checked;
                                return x;
                              })
                            }
                          />
                          表示
                        </label>
                        {!!row.groups?.some((group) => group.span > 1) && (
                          <label className="mini">
                            <input
                              type="checkbox"
                              checked={Boolean(row.lineBelow)}
                              onChange={(event) =>
                                patch((project) => {
                                  project.gels
                                    .find((gel) => gel.id === g.id)!
                                    .conditions.find(
                                      (condition) => condition.id === row.id,
                                    )!.lineBelow = event.target.checked;
                                  return project;
                                })
                              }
                            />
                            結合セルの下に区切り線を表示
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => addCondition(g.id)}>＋ 空の条件行を追加</button>
                  </details>
                </div>
              ))}
            </>
          )}
          {step === 7 && (
            <>
              <details className="stepHelp">
                <summary>この工程について</summary>
                <p>
                  ゲルごとに別パネルとして出力します。横幅はゲル単位、高さは抗体単位で揃います。主要な用途を先に表示し、互換形式と保全設定は下の詳細欄へまとめています。
                </p>
              </details>
              <details className="outputOptions" open>
                <summary>配置・文字設定</summary>
                <div className="outputSettingsGrid">
                  <label>
                    <span>フォント</span>
                    <select value={p.fontFamily} onChange={(e) => patch((x) => ({ ...x, fontFamily: e.target.value }))}>
                      <option>Helvetica</option><option>Arial</option><option>Times New Roman</option>
                    </select>
                  </label>
                  <label>
                    <span>文字サイズ（px）</span>
                    <input type="number" min="8" max="40" step="1" value={p.fontSize} onChange={(e) => patch((x) => ({ ...x, fontSize: +e.target.value }))} />
                  </label>
                  <label>
                    <span>ラベル配置</span>
                    <select value={p.labelSide} onChange={(event) => patch((project) => ({ ...project, labelSide: event.target.value as Project["labelSide"] }))}>
                      <option value="antibody-left">抗体：左／分子量：右</option>
                      <option value="antibody-right">分子量：左／抗体：右</option>
                    </select>
                  </label>
                  <label>
                    <span>Figure配置幅</span>
                    <select value={p.panelWidthMm} onChange={(e) => patch((x) => ({ ...x, panelWidthMm: +e.target.value }))}>
                      <option value="25.5">小（25.5 mm）</option>
                      <option value="39">中（39 mm）</option>
                      <option value="54">大（54 mm）</option>
                    </select>
                  </label>
                </div>
                {p.gels.length > 1 && (
                  <label className="mini syncOrderToggle">
                    <input type="checkbox" checked={p.syncGelOrder} onChange={(event) => patch((project) => ({ ...project, syncGelOrder: event.target.checked }))} />
                    ゲル間でブロットの並び替えを同期
                  </label>
                )}
              </details>
              {p.gels.map((g) => (
                <div className="panelOrder" key={g.id}>
                  <b>{g.name}</b>
                  {allRegions
                    .filter((x) => x.r.gelId === g.id)
                    .map((x, i) => (
                      <div
                        className="order"
                        key={x.r.id}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData(
                            "text/x-blotcanvas-region-order",
                            x.r.id,
                          );
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const movedId = event.dataTransfer.getData(
                            "text/x-blotcanvas-region-order",
                          );
                          if (movedId && movedId !== x.r.id)
                            reorderRegion(movedId, x.r.id);
                        }}
                      >
                        <i className="orderDragHandle" title="つかんで並べ替え">
                          ⠿
                        </i>
                        <span>{i + 1}</span>
                        <b>{x.r.antibody}</b>
                        <small>{x.c.key}</small>
                        <button onClick={() => move(x.r.id, -1)}>↑</button>
                        <button onClick={() => move(x.r.id, 1)}>↓</button>
                      </div>
                    ))}
                </div>
              ))}
              <div className="primaryExports">
                <article>
                  <b>Illustratorで編集</b>
                  <small>画像を内包し、文字と線を編集できます</small>
                  <button
                    className="primary"
                    disabled={!allRegions.length}
                    onClick={exportEditablePdf}
                  >
                    編集可能PDF
                  </button>
                </article>
                <article>
                  <b>確認・共有用</b>
                  <small>リンク切れのない完成画像です</small>
                  <button
                    disabled={!allRegions.length}
                    onClick={() => exportFlatFigure("png")}
                  >
                    PNG画像
                  </button>
                </article>
                <article>
                  <b>作業を保存</b>
                  <small>後日この状態から再開できます</small>
                  <button onClick={saveProject}>
                    プロジェクトJSON
                  </button>
                </article>
                <article>
                  <b>一括保存</b>
                  <small>Figure・保全資料・JSONをまとめて保存します</small>
                  <button
                    className="primary"
                    disabled={!allRegions.length}
                    onClick={exportFilesIndividually}
                  >
                    すべて保存
                  </button>
                </article>
              </div>
              <details className="outputOptions">
                <summary>保全資料と一括保存</summary>
                <label>
                  保全用Source recordに含める画像
                  <select
                    value={p.sourceRecordMode}
                    onChange={(e) =>
                      patch((project) => ({
                        ...project,
                        sourceRecordMode: e.target.value as Project["sourceRecordMode"],
                      }))
                    }
                  >
                    <option value="cl">シグナル画像（CL）のみ</option>
                    <option value="merge">Merge画像のみ</option>
                    <option value="both">シグナル画像とMerge画像の両方</option>
                  </select>
                </label>
                <label>
                  確認・保全資料の用紙
                  <select value={p.pageSize} onChange={(e) => patch((x) => ({ ...x, pageSize: e.target.value as "A4" | "Letter" }))}>
                    <option value="A4">A4</option><option value="Letter">Letter</option>
                  </select>
                </label>
                <p className="hint">
                  保全用画像には視認性のため表示専用の自動階調補正を適用します。元画像は変更せず、軽量プロジェクトJSONにはファイル参照と処理設定だけを保存します。
                </p>
                <button
                  className="wide"
                  disabled={!sourceRecordEntries().length}
                  onClick={exportEvidence}
                >
                  Source record SVG
                </button>
              </details>
              <details className="outputOptions">
                <summary>その他の書き出し形式</summary>
                <div className="flatExport">
                  <b>完成画像</b>
                  <div>
                    <button
                      disabled={!allRegions.length}
                      onClick={() => exportFlatFigure("jpeg")}
                    >
                      JPEG
                    </button>
                  <button
                    disabled={!allRegions.length}
                    onClick={() => exportFlatFigure("tiff")}
                  >
                    TIFF
                  </button>
                  <button
                    disabled={!allRegions.length}
                    onClick={() => exportFlatFigure("pdf")}
                  >
                    PDF
                  </button>
                </div>
                <small>
                    SVGを経由せず画面の3倍解像度で直接描画します。
                </small>
                </div>
                <button
                  className="wide"
                  disabled={!allRegions.length}
                  onClick={exportFigure}
                >
                  編集可能Figure SVG（互換性は試験中）
                </button>
              </details>
              <p className="hint">
                保存先はブラウザのダウンロード設定に従います。
              </p>
            </>
          )}
          {step === 8 && (
            <>
              <p>
                定量に使うブロットを選びます。全体画像は見やすい表示に自動調整しますが、測定値は切り出していない元シグナル画像から計算します。
              </p>
              <div className="quantTargetList">
                {allRegions.map((entry) => {
                  const target = p.quantification?.targets.find(
                    (item) => item.regionId === entry.r.id,
                  );
                  return (
                    <label key={entry.r.id} className={quantActiveRegionId === entry.r.id ? "active" : ""}>
                      <input
                        type="checkbox"
                        checked={target?.enabled || false}
                        onChange={(e) => setQuantTarget(entry.r, e.target.checked)}
                      />
                      <button
                        type="button"
                        disabled={!target?.enabled}
                        onClick={() => setQuantTarget(entry.r, true)}
                      >
                        <b>{entry.r.antibody}</b>
                        <small>{entry.c.key} · {p.gels.find((g) => g.id === entry.r.gelId)?.name}</small>
                      </button>
                    </label>
                  );
                })}
              </div>
              {(() => {
                const target = p.quantification?.targets.find(
                    (item) => item.regionId === quantActiveRegionId && item.enabled,
                  ),
                  entry = allRegions.find((item) => item.r.id === quantActiveRegionId);
                if (!target || !entry) return <p className="hint">1つ以上のブロットを選択してください。</p>;
                return (
                  <div className="quantControls">
                    <h3>{entry.r.antibody}</h3>
                    <label>
                      シグナルの向き
                      <select
                        value={target.signalMode}
                        onChange={(e) =>
                          patch((project) => {
                            const saved = project.quantification!.targets.find(
                              (item) => item.regionId === target.regionId,
                            )!;
                            saved.signalMode = e.target.value as "light" | "dark";
                            saved.measurements = [];
                            saved.measuredAt = undefined;
                            return project;
                          })
                        }
                      >
                        <option value="light">明るいバンド（CLなど）</option>
                        <option value="dark">暗いバンド</option>
                      </select>
                    </label>
                    <button onClick={() => resetQuantRois(entry.r)}>
                      レーン数からROIを再配置
                    </button>
                    <div className="quantProfileControls">
                      <label>
                        プロファイルを確認するレーン
                        <select
                          value={Math.min(
                            quantProfileLane,
                            target.rois.length || 1,
                          )}
                          onChange={(event) =>
                            setQuantProfileLane(+event.target.value)
                          }
                        >
                          {target.rois.map((roi) => (
                            <option key={roi.id} value={roi.lane}>
                              Lane {roi.lane} ·{" "}
                              {quantLaneLabel(target.regionId, roi.lane)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled={quantProfileBusy}
                        onClick={() =>
                          calculateQuantLaneProfile(
                            target.regionId,
                            Math.min(
                              quantProfileLane,
                              target.rois.length || 1,
                            ),
                          )
                        }
                      >
                        {quantProfileBusy
                          ? "元画像を解析中…"
                          : "縦方向Intensity profileを作成"}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => exportQuantRoiEvidence(target.regionId)}
                    >
                      ROI証拠保全PNG
                    </button>
                  </div>
                );
              })()}
              <button
                className="primary wide"
                disabled={quantBusy || !(p.quantification?.targets || []).some((target) => target.enabled)}
                onClick={measureAllQuantTargets}
              >
                {quantBusy ? "元画像を測定中…" : "選択したブロットを測定"}
              </button>
              {p.gels.map((gel) => {
                const gelTargets = (p.quantification?.targets || []).filter(
                  (target) =>
                    target.enabled &&
                    allRegions.find((item) => item.r.id === target.regionId)?.r
                      .gelId === gel.id,
                );
                if (!gelTargets.length) return null;
                return (
                  <label key={gel.id}>
                    {gel.name}：正規化に使うブロット
                    <select
                      value={
                        p.quantification?.normalizationRegionIds?.[gel.id] || ""
                      }
                      onChange={(e) =>
                        patch((project) => {
                          project.quantification!.normalizationRegionIds ??= {};
                          project.quantification!.normalizationRegionIds[gel.id] =
                            e.target.value;
                          return project;
                        })
                      }
                    >
                      <option value="">正規化しない</option>
                      {gelTargets.map((target) => {
                        const entry = allRegions.find(
                          (item) => item.r.id === target.regionId,
                        );
                        return (
                          <option key={target.regionId} value={target.regionId}>
                            {entry?.r.antibody} · {entry?.c.key}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                );
              })}
              <label>
                背景差し引き後が0以下の場合
                <select value={p.quantification?.nonDetectMode || "nd"} onChange={(event) => patch((project) => {
                  project.quantification!.nonDetectMode = event.target.value as Quantification["nonDetectMode"];
                  return project;
                })}>
                  <option value="nd">n.d.として数値解析から除外</option>
                  <option value="zero">0として解析に含める</option>
                </select>
              </label>
              <label>
                グラフ・正規化に使う値
                <select
                  value={p.quantification?.valueMode || "correctedIntegrated"}
                  onChange={(e) =>
                    patch((project) => {
                      project.quantification!.valueMode = e.target.value as Quantification["valueMode"];
                      return project;
                    })
                  }
                >
                  <option value="correctedIntegrated">背景補正済み面積積分値</option>
                  <option value="correctedMean">背景補正済み平均輝度</option>
                </select>
              </label>
              <button
                className="wide"
                disabled={!(p.quantification?.targets || []).some((target) => target.measurements.length)}
                onClick={exportQuantCsv}
              >
                定量結果CSV
              </button>
              <button
                className="wide"
                disabled={!(p.quantification?.targets || []).some((target) => target.enabled)}
                onClick={exportQuantRoiRecord}
              >
                ROI配置記録JSON
              </button>
              <p className="hint">
                ROI配置記録には、元画像名、回転角、各バンド枠と背景枠の座標（%・pixel）、測定時刻を保存します。作業プロジェクトJSONにもROIは保持されます。
              </p>
              {(p.quantification?.targets || []).some((target) => target.enabled && target.measurements.length > 0 && target.measurements.every((measurement) => measurement.notDetected)) && <p className="warningCard">全レーンがn.d.です。「シグナルの向き」が画像に合っているか、緑のROIがバンド上にあるか、橙色のBG枠が明るすぎる領域にないかを確認して再測定してください。</p>}
            </>
          )}
          {step === 9 && p.quantification && (
            <>
              <p>
                測定済みデータを論文図向けに整えます。軸は0から開始し、色覚多様性に配慮した配色を初期値にしています。
              </p>
              <label>
                グラフにするブロット
                <select
                  value={quantActiveRegionId}
                  onChange={(event) => setQuantActiveRegionId(event.target.value)}
                >
                  {p.quantification.targets
                    .filter((target) => target.measurements.length)
                    .map((target) => {
                      const entry = allRegions.find((item) => item.r.id === target.regionId);
                      return <option key={target.regionId} value={target.regionId}>{entry?.r.antibody} · {entry?.c.key}</option>;
                    })}
                </select>
              </label>
              <label>
                グラフタイトル（任意）
                <input type="text" value={p.quantification.graph.title} placeholder="空欄ならタイトルなし" onChange={(event) => patch((project) => {
                  project.quantification!.graph.title = event.target.value;
                  return project;
                })} />
              </label>
              <label>
                グラフ形式
                <select
                  value={p.quantification.graph.type}
                  onChange={(event) => patch((project) => {
                    project.quantification!.graph.type = event.target.value as "bar" | "dot";
                    return project;
                  })}
                >
                  <option value="bar">棒グラフ</option>
                  <option value="dot">ドットプロット</option>
                </select>
              </label>
              <label className="graphPaletteSelect">
                配色セット
                <select value={p.quantification.graph.palette} onChange={(event) => patch((project) => {
                  project.quantification!.graph.palette = event.target.value as Quantification["graph"]["palette"];
                  return project;
                })}>
                  <option value="nature">Nature系（青・赤）</option>
                  <option value="okabe-ito">Okabe–Ito（色覚対応）</option>
                  <option value="gray">グレースケール</option>
                  <option value="custom">自作RGBセット</option>
                </select>
              </label>
              {(() => {
                const activeTarget = p.quantification!.targets.find((item) => item.regionId === quantActiveRegionId && item.measurements.length)
                    || p.quantification!.targets.find((item) => item.measurements.length),
                  activeEntry = allRegions.find((item) => item.r.id === activeTarget?.regionId),
                  activeGel = p.gels.find((item) => item.id === activeEntry?.r.gelId),
                  bottomRow = activeGel?.conditions.filter((row) => row.visible).at(-1),
                  colorKeys = Array.from(new Set((activeTarget?.measurements || []).map((_, index) => bottomRow?.values[index] || `Lane ${index + 1}`))),
                  activePalette = p.quantification!.graph.palette === "custom" ? p.quantification!.graph.customColors : GRAPH_PALETTES[p.quantification!.graph.palette];
                if (!colorKeys.length) return null;
                return <div className="graphColorColumns"><b>系列ごとの色</b>{colorKeys.map((key, index) => {
                  const current = p.quantification!.colors[key] || activePalette[index % activePalette.length];
                  return <label key={key}><span>{key}</span><i style={{ background: current }} /><select aria-label={`${key}の色`} value={current} onChange={(event) => patch((project) => {
                    project.quantification!.colors[key] = event.target.value;
                    return project;
                  })}>{GRAPH_COLOR_CHOICES.map((color, colorIndex) => <option value={color} key={color}>{GRAPH_COLOR_LABELS[colorIndex]} ({color})</option>)}</select><button type="button" title="配色セットに戻す" onClick={() => patch((project) => {
                    delete project.quantification!.colors[key];
                    return project;
                  })}>↺</button></label>;
                })}<small>棒・凡例のクリックでも同じ色を変更できます。</small></div>;
              })()}
              <details className="customPaletteEditor">
                <summary>独自のRGB配色を作る</summary>
                {p.quantification.graph.customColors.map((color, colorIndex) => {
                  const rgb = hexToRgb(color);
                  return (
                    <div className="rgbColorRow" key={colorIndex}>
                      <i style={{ background: color }} />
                      <span>色{colorIndex + 1}</span>
                      {(["R", "G", "B"] as const).map((channel, channelIndex) => (
                        <label key={channel}>{channel}<input type="number" min="0" max="255" value={rgb[channelIndex]} onChange={(event) => patch((project) => {
                          const next = [...hexToRgb(project.quantification!.graph.customColors[colorIndex])];
                          next[channelIndex] = +event.target.value;
                          project.quantification!.graph.customColors[colorIndex] = rgbToHex(next);
                          project.quantification!.graph.palette = "custom";
                          return project;
                        })} /></label>
                      ))}
                    </div>
                  );
                })}
                <small>数値を変更すると自動的に「自作RGBセット」へ切り替わります。</small>
              </details>
              <label>
                フォント
                <select
                  value={p.quantification.graph.fontFamily}
                  onChange={(event) => patch((project) => {
                    project.quantification!.graph.fontFamily = event.target.value;
                    return project;
                  })}
                >
                  <option value="Helvetica">Helvetica</option>
                  <option value="Arial">Arial</option>
                  <option value="Times New Roman">Times New Roman</option>
                </select>
              </label>
              <label>
                フォントサイズ {p.quantification.graph.fontSize}px
                <input type="range" min="10" max="28" value={p.quantification.graph.fontSize} onChange={(event) => patch((project) => {
                  project.quantification!.graph.fontSize = +event.target.value;
                  return project;
                })} />
              </label>
              <div className="row">
                <label>幅<input type="number" min="500" max="1800" step="50" value={p.quantification.graph.width} onChange={(event) => patch((project) => {
                  project.quantification!.graph.width = +event.target.value;
                  return project;
                })} /></label>
                <label>高さ<input type="number" min="350" max="1200" step="50" value={p.quantification.graph.height} onChange={(event) => patch((project) => {
                  project.quantification!.graph.height = +event.target.value;
                  return project;
                })} /></label>
              </div>
              <label className="mini">
                <input type="checkbox" checked={p.quantification.graph.showValues} onChange={(event) => patch((project) => {
                  project.quantification!.graph.showValues = event.target.checked;
                  return project;
                })} />
                各値を表示
              </label>
              <button className="primary wide" onClick={exportQuantGraphPng}>
                現在のグラフPNGを書き出す
              </button>
              <button className="wide" onClick={exportQuantGraphsForAllGels}>
                同じ抗体の全ゲルを1枚のPNGにまとめる
              </button>
              <p className="hint">
                グラフPNGは背景透過で保存され、Illustrator上で選択中のFigure配置幅（{p.panelWidthMm} mm）になります。
              </p>
              <p className="hint">統計処理と独立反復の集約は将来のStep 10で追加予定です。</p>
            </>
          )}
        </aside>
        <section className="stage" ref={stagePane}>
          <div className="stageHead">
            <div>
              <small>{cap?.key || "NO CAPTURE"}</small>
              <h1>
                {step === 9
                  ? "グラフワークスペース"
                  : step === 8
                  ? "定量化ワークスペース"
                  : step === 7 || step === 6
                  ? "Figureプレビュー"
                    : step === 4
                      ? "Figure用画像プレビュー"
                      : step === 1
                        ? "撮影セットプレビュー"
                    : "Merge作業画面"}
              </h1>
            </div>
            {step === 3 && (
              <span className="sync">↔ 同じゲルの横幅を同期</span>
            )}
          </div>
          {!cap ? (
            <div className="empty">
              <div className="membrane">
                <i />
                <i />
                <i />
              </div>
              <h2>まず撮影ファイルを読み込みます</h2>
              <p>
                撮影装置を選び、画像ファイルまたは撮影フォルダを読み込んでください。
              </p>
            </div>
          ) : step === 9 ? (
            (() => {
              const target = p.quantification?.targets.find(
                  (item) => item.regionId === quantActiveRegionId && item.measurements.length,
                ) || p.quantification?.targets.find((item) => item.enabled && item.measurements.length),
                entry = allRegions.find((item) => item.r.id === target?.regionId);
              if (!target || !entry || !p.quantification)
                return <div className="empty"><h2>先にStep 8で測定します</h2><p>ROIを確認して「選択したブロットを測定」を実行してください。</p></div>;
              const settings = p.quantification.graph,
                values = quantValues(target),
                maximum = Math.max(...values.filter(Number.isFinite), 1) * 1.12,
                normalized = quantReferenceId(target) !== "" && quantReferenceId(target) !== target.regionId,
                gel = p.gels.find((item) => item.id === entry.r.gelId),
                visibleConditions = gel?.conditions.filter((row) => row.visible) || [],
                bottomCondition = visibleConditions.at(-1),
                upperConditions = visibleConditions.slice(0, -1),
                keys = Array.from(new Set(values.map((_, index) => bottomCondition?.values[index] || `Lane ${index + 1}`))),
                palette = settings.palette === "custom" ? settings.customColors : GRAPH_PALETTES[settings.palette],
                left = 110,
                right = 150,
                top = 45,
                bottom = 100 + upperConditions.length * 32,
                plotW = settings.width - left - right,
                plotH = settings.height - top - bottom,
                gap = plotW / Math.max(1, values.length),
                barWidth = Math.min(gap * 0.62, 64),
                axisScale = graphAxisScale(maximum);
              return (
                <section className="publicationGraphCard">
                  <div className="publicationGraphScroll">
                    <svg width={settings.width} height={settings.height} viewBox={`0 0 ${settings.width} ${settings.height}`} style={{ fontFamily: settings.fontFamily, fontSize: settings.fontSize }}>
                      {settings.title.trim() && <text x={settings.width / 2} y="27" textAnchor="middle" fontSize={settings.fontSize + 2} fontWeight="600">{settings.title.trim()}</text>}
                      <path d={`M ${left} ${top} V ${top + plotH} H ${left + plotW}`} fill="none" stroke="#111" strokeWidth="1.5" />
                      {Array.from({ length: 5 }, (_, tick) => {
                        const value = maximum * tick / 4,
                          y = top + plotH - plotH * tick / 4;
                        return <g key={tick}><line x1={left - 6} y1={y} x2={left} y2={y} stroke="#111" /><text x={left - 12} y={y + settings.fontSize * .35} textAnchor="end">{normalized ? value.toFixed(1) : axisScale.exponent ? (value / axisScale.divisor).toFixed(1) : value.toFixed(0)}</text></g>;
                      })}
                      {axisScale.exponent > 0 && <text x={left + 6} y={top - 10}>×10<tspan dy={-settings.fontSize * .45} fontSize={settings.fontSize * .72}>{axisScale.exponent}</tspan></text>}
                      <text transform={`translate(25 ${top + plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={settings.fontSize + 1}>{entry.r.antibody} {normalized ? "normalized intensity" : "Intensity"} (a.u.)</text>
                      {values.map((value, index) => {
                        const x = left + gap * (index + .5),
                          isNd = !Number.isFinite(value),
                          y = isNd ? top + plotH : top + plotH - value / maximum * plotH,
                          label = bottomCondition?.values[index] || `Lane ${index + 1}`,
                          key = label,
                          color = p.quantification!.colors[key] || palette[keys.indexOf(key) % palette.length];
                        return <g key={index} className="graphSelectable" onClick={() => setGraphColorKey(key)}>
                          {isNd ? <text x={x} y={top + plotH - 8} textAnchor="middle" fill="#555">n.d.</text> : settings.type === "bar" ? <rect x={x - barWidth / 2} y={y} width={barWidth} height={top + plotH - y} fill={color} stroke="#111" strokeWidth="1" /> : <circle cx={x} cy={y} r="5" fill={color} stroke="#111" />}
                          {settings.showValues && !isNd && <text x={x} y={Math.max(top + settings.fontSize, y - 10)} textAnchor="middle">{value.toFixed(normalized ? 2 : 0)}</text>}
                          <text x={x} y={top + plotH + settings.fontSize + 9} textAnchor="middle">{label}</text>
                        </g>;
                      })}
                      {[...upperConditions].reverse().flatMap((condition, rowIndex) => {
                        const y = top + plotH + 64 + rowIndex * 32,
                          elements: ReactNode[] = [<text key={`${condition.id}-name`} x={left - 12} y={y} textAnchor="end">{condition.name}</text>];
                        if (condition.groups?.length) {
                          condition.groups.forEach((group) => {
                            if (!group.label.trim()) return;
                            const start = Math.max(0, group.start),
                              end = Math.min(values.length, start + group.span),
                              x1 = left + gap * start + gap * .18,
                              x2 = left + gap * end - gap * .18;
                            elements.push(<text key={`${condition.id}-${start}`} x={(x1 + x2) / 2} y={y} textAnchor="middle">{group.label}</text>);
                            if (end - start > 1) elements.push(<line key={`${condition.id}-${start}-line`} x1={x1} y1={y - settings.fontSize - 5} x2={x2} y2={y - settings.fontSize - 5} stroke="#111" />);
                          });
                          return elements;
                        }
                        for (let start = 0; start < values.length;) {
                          const label = condition.values[start] || "";
                          let end = start + 1;
                          while (end < values.length && condition.values[end] === label) end++;
                          if (label) {
                            const x1 = left + gap * start + gap * .18,
                              x2 = left + gap * end - gap * .18;
                            elements.push(<text key={`${condition.id}-${start}`} x={(x1 + x2) / 2} y={y} textAnchor="middle">{label}</text>);
                            if (end - start > 1) elements.push(<line key={`${condition.id}-${start}-line`} x1={x1} y1={y - settings.fontSize - 5} x2={x2} y2={y - settings.fontSize - 5} stroke="#111" />);
                          }
                          start = end;
                        }
                        return elements;
                      })}
                      {keys.map((key, index) => {
                        const y = top + 15 + index * 27,
                          x = left + plotW + 25;
                        const color = p.quantification!.colors[key] || palette[index % palette.length];
                        return <g key={`legend-${key}`} className="graphSelectable" onClick={() => setGraphColorKey(key)}><rect x={x} y={y - 12} width="16" height="16" fill={color} stroke="#111" /><text x={x + 24} y={y + 1}>{key}</text></g>;
                      })}
                    </svg>
                  </div>
                  {graphColorKey && keys.includes(graphColorKey) && (
                    <div className="graphQuickColors">
                      <b>「{graphColorKey}」の色</b>
                      <div>{GRAPH_COLOR_CHOICES.map((color) => <button key={color} type="button" aria-label={`${graphColorKey}を${color}に変更`} style={{ background: color }} onClick={() => patch((project) => {
                        project.quantification!.colors[graphColorKey] = color;
                        return project;
                      })} />)}</div>
                      <button type="button" className="resetGraphColor" onClick={() => patch((project) => {
                        delete project.quantification!.colors[graphColorKey];
                        return project;
                      })}>配色セットに戻す</button>
                    </div>
                  )}
                  <p className="quantMethod">軸は0から開始します。単一実験の各レーン値なので、現段階では誤差棒・有意差は表示しません。</p>
                </section>
              );
            })()
          ) : step === 8 ? (
            (() => {
              const target = p.quantification?.targets.find(
                  (item) => item.regionId === quantActiveRegionId && item.enabled,
                ),
                entry = allRegions.find((item) => item.r.id === quantActiveRegionId);
              if (!target || !entry)
                return (
                  <div className="empty quantEmpty">
                    <h2>定量するブロットを選択します</h2>
                    <p>左側から1つ以上選ぶと、レーン数に合わせてROIが自動配置されます。</p>
                  </div>
                );
              const gel = p.gels.find((item) => item.id === entry.r.gelId);
              const profile =
                  quantLaneProfile?.regionId === target.regionId
                    ? quantLaneProfile
                    : undefined,
                profileWidth = 600,
                profileHeight = 210,
                profileLeft = 54,
                profileTop = 18,
                profilePlotWidth = 520,
                profilePlotHeight = 150,
                profileMaximum = Math.max(
                  1,
                  ...(profile?.points.map((point) =>
                    Math.max(0, point.netIntensity),
                  ) || [1]),
                ),
                profilePath = profile?.points
                  .map((point, index) => {
                    const x =
                        profileLeft +
                        (point.position / 100) * profilePlotWidth,
                      y =
                        profileTop +
                        profilePlotHeight -
                        (Math.max(0, point.netIntensity) / profileMaximum) *
                          profilePlotHeight;
                    return `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
                  })
                  .join(" "),
                measurements = target.measurements,
                notDetectedCount = measurements.filter(
                  (measurement) => measurement.notDetected,
                ).length,
                saturatedLanes = measurements.filter(
                  (measurement) => measurement.saturatedPercent > 0.1,
                );
              return (
                <div className="quantWorkspace">
                  <section className="quantImagePanel">
                    <header>
                      <div><b>{entry.r.antibody}</b><small>{entry.c.key} · {gel?.name}</small></div>
                      <span>
                        Figure用と同じ反転・色調で表示／測定は元画像
                        {target.measurements[0]?.bitDepth
                          ? ` · ${target.measurements[0].bitDepth}-bit測定`
                          : ` · ${(entry.c.cl || entry.c.merge)?.bitsPerSample || 8}-bit入力`}
                      </span>
                      <label className="quantZoomControl">
                        表示倍率
                        <input
                          type="range"
                          min="50"
                          max="200"
                          step="10"
                          value={quantZoom}
                          onChange={(event) => setQuantZoom(+event.target.value)}
                        />
                        <b>{quantZoom}%</b>
                      </label>
                    </header>
                    <div
                      className="quantImage"
                      style={{ width: `${quantZoom}%` }}
                      onPointerMove={quantPointerMove}
                      onPointerUp={() => (quantDrag.current = null)}
                      onPointerLeave={() => (quantDrag.current = null)}
                    >
                      {quantPreviews[target.regionId] ? (
                        <img src={quantPreviews[target.regionId]} alt="定量用の全体画像" />
                      ) : (
                        <div className="quantLoading">元画像を準備しています…</div>
                      )}
                      {target.rois.map((roi) => (
                        <div
                          className="quantRoi"
                          key={roi.id}
                          style={{ left: `${roi.x}%`, top: `${roi.y}%`, width: `${roi.w}%`, height: `${roi.h}%` }}
                          onPointerDown={(event) => {
                            const bounds = event.currentTarget.parentElement!.getBoundingClientRect();
                            quantDrag.current = {
                              regionId: target.regionId,
                              roiId: roi.id,
                              mode: "move",
                              offsetX: ((event.clientX - bounds.left) / bounds.width) * 100 - roi.x,
                              offsetY: ((event.clientY - bounds.top) / bounds.height) * 100 - roi.y,
                            };
                            event.currentTarget.setPointerCapture(event.pointerId);
                          }}
                        >
                          <b>{roi.lane}</b>
                          <i
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              event.currentTarget.parentElement!.setPointerCapture(event.pointerId);
                              quantDrag.current = {
                                regionId: target.regionId,
                                roiId: roi.id,
                                mode: "resize",
                                offsetX: 0,
                                offsetY: 0,
                              };
                            }}
                          />
                        </div>
                      ))}
                      {target.backgroundRoi && (
                        <div
                          className="quantRoi quantBackgroundRoi"
                          style={{
                            left: `${target.backgroundRoi.x}%`,
                            top: `${target.backgroundRoi.y}%`,
                            width: `${target.backgroundRoi.w}%`,
                            height: `${target.backgroundRoi.h}%`,
                          }}
                          onPointerDown={(event) => {
                            const bounds = event.currentTarget.parentElement!.getBoundingClientRect(),
                              roi = target.backgroundRoi!;
                            quantDrag.current = {
                              regionId: target.regionId,
                              roiId: "__background__",
                              mode: "move",
                              offsetX: ((event.clientX - bounds.left) / bounds.width) * 100 - roi.x,
                              offsetY: ((event.clientY - bounds.top) / bounds.height) * 100 - roi.y,
                            };
                            event.currentTarget.setPointerCapture(event.pointerId);
                          }}
                        >
                          <b>BG</b>
                          <i
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              event.currentTarget.parentElement!.setPointerCapture(event.pointerId);
                              quantDrag.current = {
                                regionId: target.regionId,
                                roiId: "__background__",
                                mode: "resize",
                                offsetX: 0,
                                offsetY: 0,
                              };
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <p className="quantMethod">
                      緑枠が各レーンのバンド領域、橙色のBG枠が共通背景領域です。BG枠をシグナルや汚れのないメンブレン領域へ移動してください。表示補正は測定値に影響しません。
                    </p>
                  </section>
                  <section className="quantResults">
                    <h2>ROIと測定値</h2>
                    <div className="quantRoiTable">
                      <div className="quantTableHead"><span>Lane</span><span>X</span><span>Y</span><span>幅</span><span>高さ</span><span>補正Mean</span><span>積分値</span></div>
                      {target.rois.map((roi, index) => {
                        const measurement = target.measurements[index],
                          isNd = p.quantification?.nonDetectMode === "nd" && measurement?.notDetected;
                        return (
                          <div className="quantTableRow" key={roi.id}>
                            <b>{roi.lane}</b>
                            {(["x", "y", "w", "h"] as const).map((key) => (
                              <input
                                key={key}
                                type="number"
                                min="0"
                                max="100"
                                step="0.2"
                                value={roi[key].toFixed(1)}
                                onChange={(e) => patchQuantRoi(target.regionId, roi.id, { [key]: +e.target.value })}
                              />
                            ))}
                            <span className={isNd ? "notDetected" : ""}>{measurement ? isNd ? "n.d." : measurement.correctedMean.toFixed(2) : "—"}</span>
                            <span className={measurement && measurement.saturatedPercent > 0.1 ? "warning" : ""}>
                              {measurement ? isNd ? "n.d." : measurement.correctedIntegrated.toFixed(0) : "—"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {measurements.length > 0 && (
                      <div
                        className={`quantQcSummary ${
                          saturatedLanes.length ? "hasWarning" : ""
                        }`}
                      >
                        <b>定量QC</b>
                        <span>
                          {measurements[0].bitDepth}-bit ·{" "}
                          {measurements.length} lanes
                        </span>
                        <span>n.d. {notDetectedCount}</span>
                        <span>
                          飽和注意{" "}
                          {saturatedLanes.length
                            ? saturatedLanes
                                .map(
                                  (measurement) =>
                                    `Lane ${measurement.lane} (${measurement.saturatedPercent.toFixed(2)}%)`,
                                )
                                .join(", ")
                            : "なし"}
                        </span>
                      </div>
                    )}
                    {profile && (
                      <div className="quantProfilePanel">
                        <header>
                          <div>
                            <b>
                              Lane {profile.lane} intensity profile
                            </b>
                            <small>
                              元{profile.bitDepth}-bit画像・ROI内を上から下へ走査
                            </small>
                          </div>
                          <button
                            type="button"
                            onClick={exportQuantLaneProfileCsv}
                          >
                            Profile CSV
                          </button>
                        </header>
                        <svg
                          viewBox={`0 0 ${profileWidth} ${profileHeight}`}
                          role="img"
                          aria-label={`Lane ${profile.lane}の縦方向Intensity profile`}
                        >
                          <line
                            x1={profileLeft}
                            y1={profileTop + profilePlotHeight}
                            x2={profileLeft + profilePlotWidth}
                            y2={profileTop + profilePlotHeight}
                          />
                          <line
                            x1={profileLeft}
                            y1={profileTop}
                            x2={profileLeft}
                            y2={profileTop + profilePlotHeight}
                          />
                          <path d={profilePath} />
                          <text
                            x={profileLeft}
                            y={profileTop + profilePlotHeight + 25}
                            textAnchor="middle"
                          >
                            ROI上端
                          </text>
                          <text
                            x={profileLeft + profilePlotWidth}
                            y={profileTop + profilePlotHeight + 25}
                            textAnchor="middle"
                          >
                            ROI下端
                          </text>
                          <text
                            transform={`translate(16 ${
                              profileTop + profilePlotHeight / 2
                            }) rotate(-90)`}
                            textAnchor="middle"
                          >
                            BG補正Intensity
                          </text>
                        </svg>
                        <p>
                          背景値 {profile.background.toFixed(2)}。負の値はグラフ上では0として表示し、CSVには符号付きで保存します。ピーク範囲とbaselineの確定・積分は未実装です。
                        </p>
                      </div>
                    )}
                  </section>
                </div>
              );
            })()
          ) : step === 7 || step === 6 ? (
            figurePreviewPanels.length ? (
              <div className="generatedFigurePreview editableFigurePreview">
                <div className="conditionWorkspaceTabs">
                  <button
                    type="button"
                    className={
                      conditionWorkspaceView === "table" ? "active" : ""
                    }
                    onClick={() => setConditionWorkspaceView("table")}
                  >
                    表を編集
                  </button>
                  <button
                    type="button"
                    className={
                      conditionWorkspaceView === "figure" ? "active" : ""
                    }
                    onClick={() => setConditionWorkspaceView("figure")}
                  >
                    Figureプレビュー
                  </button>
                  <button type="button" aria-pressed={figurePreviewReadable} onClick={() => setFigurePreviewReadable(value => !value)}>文字を拡大</button>
                </div>
                {conditionWorkspaceView === "table" ? (
                <div className="previewInlineEditor">
                  <header>
                    <b>✎ Figureを見ながらラベル表を編集</b>
                    <small>
                      抗体名、条件ラベル、セル結合をここで調整できます
                    </small>
                  </header>
                  <div className="conditionGelTabs" role="tablist">
                    {p.gels.map((gel) => (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={(conditionGelId || p.gels[0]?.id) === gel.id}
                        className={(conditionGelId || p.gels[0]?.id) === gel.id ? "active" : ""}
                        onClick={() => setConditionGelId(gel.id)}
                        key={gel.id}
                      >
                        {gel.name}
                      </button>
                    ))}
                  </div>
                  {p.gels.filter((gel) => gel.id === (conditionGelId || p.gels[0]?.id)).map((gel) => (
                    <details className="previewGelEditor" open key={gel.id}>
                      <summary>{gel.name}</summary>
                      <div className="previewAntibodyNames">
                        {allRegions
                          .filter(({ r }) => r.gelId === gel.id)
                          .map(({ c, r }) => (
                            <label key={r.id}>
                              <span>抗体名</span>
                              <input
                                aria-label={`${r.antibody}の抗体名`}
                                title="クリックして抗体名を編集"
                                value={r.antibody}
                                onChange={(event) => {
                                  const value = event.currentTarget.value;
                                  patch((project) => {
                                    project.captures
                                      .find((item) => item.id === c.id)!
                                      .regions.find(
                                        (item) => item.id === r.id,
                                      )!.antibody = value;
                                    return project;
                                  });
                                }}
                              />
                            </label>
                          ))}
                      </div>
                      {renderConditionSpreadsheet(gel)}
                      <div className="conditionLivePreview">
                        <b>{gel.name} · Figure preview</b>
                        {figurePreviewPanels.filter(panel => panel.gelId === gel.id).map(panel => <img key={panel.gelId} src={panel.data} style={{minWidth: figurePreviewReadable ? Math.round(panel.width * 0.75) : 0}} alt={`${gel.name}の条件ラベルとband preview`} />)}
                      </div>
                    </details>
                  ))}
                </div>
                ) : (
                <div className="figurePreviewStack">{p.gels.map(gel => {
                  const panel = figurePreviewPanels.find(item => item.gelId === gel.id);
                  return panel && <section className="figurePreviewGel" key={gel.id} aria-label={`${gel.name} Figureプレビュー`}>
                    <h2>{gel.name}</h2><div className="figurePreviewScroll"><img src={panel.data} style={{minWidth: figurePreviewReadable ? Math.round(panel.width * 0.75) : 0}} alt={`${gel.name} · 書き出しと共通のFigureプレビュー`} /></div>
                  </section>;
                })}</div>
                )}
              </div>
            ) : (
            <div className="panelPreviewGrid">
              {p.gels.map((g) => (
                <div className="paper panelPaper" key={g.id}>
                  <h2>{g.name}</h2>
                  <div
                    className="previewConditions"
                    style={{ fontFamily: p.fontFamily }}
                  >
                    {g.conditions
                      .filter((r) => r.visible)
                      .map((r) => (
                        <div key={r.id} className="previewConditionRow">
                          <b>{r.name}</b>
                          <div
                            className="previewLaneTrack"
                            style={{ width: "100%" }}
                          >
                            {r.groups?.length
                              ? r.groups.map((group) => {
                                  if (!group.label.trim()) return null;
                                  const start = Math.max(0, group.start),
                                    end = Math.min(g.lanes, start + group.span),
                                    lineLeft =
                                      g.laneCenter +
                                      (start / g.lanes - 0.5) * g.laneSpan,
                                    lineWidth =
                                      ((end - start) / g.lanes) * g.laneSpan;
                                  return (
                                    <span
                                      className={`groupedLaneLabel ${groupShowsSeparator(r, group) ? "withLine" : ""}`}
                                      key={`${start}-${end}`}
                                      style={{
                                        left: `${lineLeft}%`,
                                        width: `${lineWidth}%`,
                                      }}
                                    >
                                      {group.label}
                                    </span>
                                  );
                                })
                              : r.groupSize === 2
                                ? Array.from(
                                    { length: Math.ceil(g.lanes / 2) },
                                    (_, groupIndex) => {
                                      const start = groupIndex * 2,
                                        end = Math.min(g.lanes, start + 2),
                                        lineLeft =
                                          g.laneCenter +
                                          (start / g.lanes - 0.5) * g.laneSpan,
                                        lineWidth =
                                          ((end - start) / g.lanes) *
                                          g.laneSpan;
                                      return (
                                        <span
                                          className={`groupedLaneLabel ${r.lineBelow ? "withLine" : ""}`}
                                          key={start}
                                          style={{
                                            left: `${lineLeft}%`,
                                            width: `${lineWidth}%`,
                                          }}
                                        >
                                          {r.values[start]}
                                        </span>
                                      );
                                    },
                                  )
                                : r.values.map((v, i) => (
                                    <span
                                      key={i}
                                      style={{
                                        left: `${g.laneCenter + ((i + 0.5) / g.lanes - 0.5) * g.laneSpan}%`,
                                      }}
                                    >
                                      {v}
                                    </span>
                                  ))}
                          </div>
                        </div>
                      ))}
                  </div>
                  {allRegions
                    .filter((x) => x.r.gelId === g.id)
                    .map((x, rowIndex) => (
                      <div className={`previewRow ${p.labelSide === "antibody-right" ? "reverseLabels" : ""}`} key={x.r.id}>
                        <b>{x.r.antibody}</b>
                        <div
                          className="previewCrop"
                          style={{
                            width: "100%",
                            aspectRatio: `${((x.c.cl || x.c.merge)!.width * g.width) / 100 / (((x.c.cl || x.c.merge)!.height * x.r.h) / 100)}`,
                          }}
                        >
                          <img
                            src={
                              x.r.adjustment?.preview ||
                              x.c.clPreview ||
                              (x.c.cl || x.c.merge)!.data
                            }
                            style={{
                              ...regionProcessingStyle(x.c, x.r),
                              width: `${10000 / g.width}%`,
                              height: `${10000 / x.r.h}%`,
                              left: `${(-(x.r.x ?? p.cropX) * 100) / g.width}%`,
                              top: `${(-x.r.y * 100) / x.r.h}%`,
                            }}
                          />
                        </div>
                        <div className="previewMw">
                          {rowIndex === 0 &&
                            allRegions
                              .filter(({ r }) => r.gelId === g.id)
                              .some(({ r }) =>
                                figureMarkers(r).some(
                                  (m) =>
                                    m.on &&
                                    m.placed &&
                                    m.y >= r.y &&
                                    m.y <= r.y + r.h,
                                ),
                              ) && <small>(kD)</small>}
                          {figureMarkers(x.r)
                            .filter(
                              (m) =>
                                m.on &&
                                m.placed &&
                                m.y >= x.r.y &&
                                m.y <= x.r.y + x.r.h,
                            )
                            .map((m) => (
                              <span
                                key={m.mw}
                                style={{
                                  top: `${((m.y - x.r.y) / x.r.h) * 100}%`,
                                }}
                              >
                                {m.mw}
                              </span>
                            ))}
                        </div>
                      </div>
                    ))}
                </div>
              ))}
            </div>
            )
          ) : step === 1 ? (
            <div className="capturePreviewWorkspace">
              <div className="capturePreviewIntro">
                <div>
                  <b>撮影セットを画像で確認</b>
                  <span>
                    Mergeを優先表示します。画像ごとにCL・Merge・Mを切り替えられます。
                  </span>
                </div>
                <em>
                  現在 {p.gels.length}ゲル構成
                </em>
              </div>
              {p.gels.length > 1 && p.captures.length > 0 && (
                <div className="captureGelAssignment">
                  <div>
                    <b>撮影とゲルの対応</b>
                    <span>
                      同じ撮影内に複数ゲルがあるか、ゲルごとに別撮影かを選びます。
                    </span>
                  </div>
                  <div className="captureGelAssignmentActions">
                    <button type="button" onClick={assignAllCapturesToAllGels}>
                      各撮影に全ゲルが写っている
                    </button>
                    <button
                      type="button"
                      className="primary"
                      onClick={assignCapturesByOrder}
                      disabled={p.captures.length !== p.gels.length}
                    >
                      撮影順に1撮影＝1ゲル
                    </button>
                  </div>
                  <small>
                    個別の例外は、下の各画像にあるGelチェックで修正できます。
                  </small>
                </div>
              )}
              <div className="capturePreviewGrid">
                {p.captures.map((capture) => {
                  const requestedRole =
                      capturePreviewRole[capture.id] ||
                      (capture.merge
                        ? "merge"
                        : capture.cl
                          ? "cl"
                          : "m"),
                    role =
                      capture[requestedRole]
                        ? requestedRole
                        : capture.merge
                          ? "merge"
                          : capture.cl
                            ? "cl"
                            : "m",
                    image = capture[role],
                    preview =
                      role === "cl"
                        ? capture.clPreview || image?.data
                        : viewAuto[`${capture.id}:${role}`] || image?.data;
                  if (!image || !preview) return null;
                  return (
                    <article
                      className={`capturePreviewCard ${
                        cap?.id === capture.id ? "selected" : ""
                      }`}
                      key={capture.id}
                    >
                      <header>
                        <button
                          type="button"
                          className="capturePreviewSelect"
                          onClick={() => setActive(capture.id)}
                        >
                          <b>{capture.key}</b>
                          <small>
                            {capture.antibodies.length
                              ? capture.antibodies.join(" · ")
                              : "抗体名未入力"}
                          </small>
                        </button>
                        <span>
                          {image.width} × {image.height}px
                        </span>
                      </header>
                      <label className="capturePreviewAntibodyEditor">
                        <span>抗体名（直接編集も可能）</span>
                        <input
                          value={
                            antibodyDrafts[capture.id] ??
                            capture.antibodies.join(", ")
                          }
                          placeholder="例：GFP, GAPDH"
                          onFocus={(event) => {
                            const value = event.currentTarget.value;
                            setActive(capture.id);
                            setAntibodyDrafts((old) => ({
                              ...old,
                              [capture.id]:
                                old[capture.id] ?? value,
                            }));
                          }}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            setAntibodyDrafts((old) => ({
                              ...old,
                              [capture.id]: value,
                            }));
                          }}
                          onBlur={(event) => {
                            const antibodies = event.currentTarget.value
                              .split(/[,，、]+/)
                              .map((item) => item.trim())
                              .filter(Boolean);
                            patchCap(capture.id, { antibodies });
                            setAntibodyDrafts((old) => {
                              const next = { ...old };
                              delete next[capture.id];
                              return next;
                            });
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter")
                              event.currentTarget.blur();
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="capturePreviewImage"
                        onClick={() => setActive(capture.id)}
                        aria-label={`${capture.key}を選択`}
                      >
                        <img
                          src={preview}
                          alt={`${capture.key} ${role.toUpperCase()} preview`}
                        />
                      </button>
                      <div className="capturePreviewRoles">
                        {(["merge", "cl", "m"] as const).map((candidate) => (
                          <button
                            type="button"
                            key={candidate}
                            disabled={!capture[candidate]}
                            className={role === candidate ? "active" : ""}
                            title={capture[candidate]?.name || ""}
                            onClick={() =>
                              setCapturePreviewRole((old) => ({
                                ...old,
                                [capture.id]: candidate,
                              }))
                            }
                          >
                            {candidate === "merge"
                              ? "Merge"
                              : candidate === "cl"
                                ? "CL"
                                : "M"}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="dangerText"
                          onClick={() => excludeCapture(capture.id)}
                        >
                          このセットを除外
                        </button>
                      </div>
                      <fieldset className="captureGelChecks">
                        <legend>この撮影に含まれるゲル</legend>
                        {p.gels.map((gel) => (
                          <label key={gel.id}>
                            <input
                              type="checkbox"
                              checked={captureGelIds(capture).includes(gel.id)}
                              onChange={(event) =>
                                setCaptureGelAssignment(
                                  capture.id,
                                  gel.id,
                                  event.target.checked,
                                )
                              }
                            />
                            <span>{gel.name}</span>
                          </label>
                        ))}
                      </fieldset>
                      <footer>
                        <span>{image.name}</span>
                        {capture.folder && <small>{capture.folder}</small>}
                      </footer>
                    </article>
                  );
                })}
              </div>
              <p className="capturePreviewFootnote">
                ここでは撮影セットの採否とゲル数を確認します。各ゲルの正確な範囲はStep 3「領域指定」で設定します。
              </p>
            </div>
          ) : step === 2 ? (
            <div className="allCaptures">
              {p.captures
                .filter((c) => c.merge)
                .flatMap((c) =>
                  captureGels(c).map((gel) => {
                    const key = `${c.id}:${gel.id}`,
                      rotation = c.gelRotations?.[gel.id] ?? c.rotation,
                      guideY = align[key]?.[0]?.y ?? 50;
                    return (
                      <article
                        className={
                          c.id === cap.id &&
                          (activeGelId ? gel.id === activeGelId : gel.id === captureGels(c)[0]?.id)
                            ? "captureBoard active"
                            : "captureBoard"
                        }
                        key={key}
                        onClick={() => {
                          setActive(c.id);
                          setActiveGelId(gel.id);
                        }}
                      >
                        <header>
                          <b>
                            {c.key} · {gel.name}
                          </b>
                          <span>{rotation.toFixed(2)}°</span>
                        </header>
                        <div
                          className="imageWrap alignBoard"
                          onPointerDown={(e) => alignClick(e, c, gel.id)}
                        >
                          <img
                            draggable={false}
                            src={viewAuto[`${c.id}:merge`] || c.merge!.data}
                            style={{
                              transform: `rotate(${rotation}deg)`,
                            }}
                          />
                          <i
                            className="coarseGuide"
                            style={{ top: `${guideY}%` }}
                          />
                          <i
                            className="alignPoint"
                            style={{
                              left: `${align[key]?.[0]?.x ?? 50}%`,
                              top: `${guideY}%`,
                            }}
                          >
                            1
                          </i>
                        </div>
                        <label className="cardSlider">
                          {gel.name}の回転 {rotation.toFixed(2)}°
                          <input
                            type="range"
                            min="-5"
                            max="5"
                            step=".05"
                            value={rotation}
                            onChange={(e) =>
                              setGelRotation(c.id, gel.id, +e.target.value)
                            }
                          />
                        </label>
                      </article>
                    );
                  }),
                )}
            </div>
          ) : step === 3 ? (
            <div className="allCaptures">
              {p.captures
                .filter((c) => c.merge || c.cl)
                .flatMap((c) => captureGels(c).map((gel) => (
                  <article
                    className={
                      c.id === cap.id &&
                      (activeGelId ? gel.id === activeGelId : gel.id === captureGels(c)[0]?.id)
                        ? "captureBoard active"
                        : "captureBoard"
                    }
                    key={`${c.id}:${gel.id}`}
                  >
                    <header>
                      <button
                        className="captureSelect"
                        onClick={() => {
                          setActive(c.id);
                          setActiveGelId(gel.id);
                        }}
                      >
                        <b>{c.key} · {gel.name}</b>
                        <small>この画像を選択</small>
                      </button>
                      <span>{c.regions.filter((r) => r.gelId === gel.id).length} regions</span>
                    </header>
                    <div
                      className="imageWrap"
                      onPointerDown={(e) => pointerDown(e, c, gel.id)}
                      onPointerMove={editMove}
                      onPointerUp={pointerUp}
                    >
                      <img
                        draggable={false}
                        src={
                          c.merge
                            ? viewAuto[`${c.id}:merge`] || c.merge.data
                            : c.cl!.data
                        }
                        style={{
                          transform: `rotate(${c.gelRotations?.[gel.id] ?? c.rotation}deg)`,
                          filter: c.merge
                            ? undefined
                            : "brightness(135%) contrast(110%)",
                        }}
                      />
                      {c.regions.filter((r) => r.gelId === gel.id).map((r) => (
                        <div
                          onPointerDown={(e) => e.stopPropagation()}
                          className={`cropbox ${region?.id === r.id ? "selected" : ""}`}
                          style={{
                            left: `${r.x ?? p.cropX}%`,
                            top: `${r.y}%`,
                            width: `${gelWidth(r.gelId)}%`,
                            height: `${r.h}%`,
                          }}
                          key={r.id}
                        >
                          <span>{r.name}</span>
                          <button
                            className="moveHandle"
                            onPointerDown={(e) => editDown(e, c, r, "move")}
                            aria-label="領域を移動"
                          />
                          {["lt", "rt", "lb", "rb"].map((h) => (
                            <button
                              key={h}
                              className={`corner ${h}`}
                              onPointerDown={(e) => editDown(e, c, r, h)}
                              aria-label={`${h}角を変更`}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </article>
                )))}
            </div>
          ) : step === 4 ? (
            <div className="allCaptures">
              {allRegions
                .filter(({ c }) => c.cl)
                .map(({ c, r }) => (
                  <article
                    className={
                      r.id === region?.id
                        ? "captureBoard active"
                        : "captureBoard"
                    }
                    key={r.id}
                    onClick={() => {
                      setActive(c.id);
                      setRegionId(r.id);
                    }}
                  >
                    <header>
                      <b>
                        {c.key} · {r.antibody}
                      </b>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          autoClFor(c, r);
                        }}
                      >
                        領域Auto
                      </button>
                    </header>
                    <div
                      className="regionPreview"
                      style={{
                        width: "100%",
                        maxWidth: "100%",
                        minWidth: 0,
                        overflow: "hidden",
                        aspectRatio: `${(c.cl!.width * gelWidth(r.gelId)) / 100 / ((c.cl!.height * r.h) / 100)}`,
                      }}
                    >
                      <img
                        draggable={false}
                        src={r.adjustment?.preview || c.clPreview || c.cl!.data}
                        style={{
                          ...regionProcessingStyle(c, r),
                          width: `${10000 / gelWidth(r.gelId)}%`,
                          height: `${10000 / r.h}%`,
                          left: `${(-r.x * 100) / gelWidth(r.gelId)}%`,
                          top: `${(-r.y * 100) / r.h}%`,
                        }}
                      />
                    </div>
                    <div className="cardControls">
                      <label>
                        Min {r.adjustment?.min ?? 0}
                        <input
                          type="range"
                          min="0"
                          max={2 ** (c.cl!.bitsPerSample || 8) - 2}
                          step={c.cl!.bitsPerSample === 16 ? 16 : 1}
                          value={r.adjustment?.min ?? 0}
                          onChange={(e) =>
                            void applyRawRange(c, r, {
                              min: +e.target.value,
                              max: r.adjustment?.max ?? 2 ** (c.cl!.bitsPerSample || 8) - 1,
                              bitDepth: c.cl!.bitsPerSample || 8,
                              invert: r.adjustment?.invert ?? c.invert,
                            })
                          }
                        />
                      </label>
                      <label>
                        Max {r.adjustment?.max ?? 2 ** (c.cl!.bitsPerSample || 8) - 1}
                        <input
                          type="range"
                          min="1"
                          max={2 ** (c.cl!.bitsPerSample || 8) - 1}
                          step={c.cl!.bitsPerSample === 16 ? 16 : 1}
                          value={r.adjustment?.max ?? 2 ** (c.cl!.bitsPerSample || 8) - 1}
                          onChange={(e) =>
                            void applyRawRange(c, r, {
                              min: r.adjustment?.min ?? 0,
                              max: +e.target.value,
                              bitDepth: c.cl!.bitsPerSample || 8,
                              invert: r.adjustment?.invert ?? c.invert,
                            })
                          }
                        />
                      </label>
                      <small className="rangeMeta">
                        {r.adjustment?.mode === "minmax"
                          ? `${r.adjustment.bitDepth}-bit · clip ${r.adjustment.clippedLowPercent?.toFixed(1) || 0}/${r.adjustment.clippedHighPercent?.toFixed(1) || 0}%`
                          : "旧方式（AutoでMin / Maxへ変換）"}
                      </small>
                    </div>
                  </article>
                ))}
            </div>
          ) : (
            <div className="allCaptures markerGrid">
              {allRegions
                .filter(({ c }) => c.m || c.merge)
                .map(({ c, r }) => {
                  const src = (c.m || c.merge)!,
                    markerState =
                      p.gels.find((gel) => gel.id === r.gelId)?.markerState ||
                      "unconfirmed";
                  return (
                    <article
                      className={
                        r.id === region?.id
                          ? "captureBoard active"
                          : "captureBoard"
                      }
                      key={r.id}
                    >
                      <header>
                        <button
                          className="captureSelect"
                          onClick={() => {
                            setActive(c.id);
                            setRegionId(r.id);
                            if (r.markerPresetId) {
                              setActiveMarkerPreset(r.markerPresetId);
                            }
                          }}
                        >
                          <b>
                            {c.key} · {r.antibody}
                          </b>
                          <small>
                            {p.gels.find((g) => g.id === r.gelId)?.name}
                            のマーカーを設定
                          </small>
                        </button>
                        <span>{r.name}</span>
                      </header>
                      <div
                        className={`imageWrap markerPick markerFull ${markerState === "none" ? "markerDisabled" : ""}`}
                        onPointerDown={(e) =>
                          markerState !== "none" && markerClickFor(e, c, r)
                        }
                      >
                        <img
                          draggable={false}
                          src={
                            viewAuto[`${c.id}:${c.m ? "m" : "merge"}`] ||
                            src.data
                          }
                          style={{
                            transform: `rotate(${r.rotation ?? c.rotation}deg)`,
                          }}
                        />
                        <div
                          className="markerRegionBox"
                          style={{
                            left: `${r.x}%`,
                            top: `${r.y}%`,
                            width: `${gelWidth(r.gelId)}%`,
                            height: `${r.h}%`,
                          }}
                        >
                          <span>{r.antibody}</span>
                        </div>
                        {figureMarkers(r)
                          .filter((m) => m.on && m.placed)
                          .map((m) => (
                            <i
                              key={m.mw}
                              className="manualMarker"
                              style={{ top: `${m.y}%` }}
                            >
                              <b>{m.mw}</b>
                            </i>
                          ))}
                        {markerState === "none" && (
                          <strong className="markerDisabledLabel">
                            このFigureではマーカーを表示しません
                          </strong>
                        )}
                      </div>
                    </article>
                  );
                })}
              <div className="markerLegend">
                全体画像上で、選択した分子量のバンド位置をクリック
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
