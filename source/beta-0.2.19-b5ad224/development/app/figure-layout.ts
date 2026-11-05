import { labelWidthEstimate } from "./label-layout.ts";

type FigureGel = {
  id: string; name: string; width: number; lanes: number; laneSpan?: number;
  conditions: { name: string; visible: boolean; values: string[]; groupSize?: number;
    groups?: { label: string; span: number }[] }[];
};

/** Drawing units only. Does not change saved physical dimensions or gel order. */
export function figureDrawingMetrics(
  gels: FigureGel[], labels: string[], fontSize: number, side: string,
  measure: (value: string) => number = value => labelWidthEstimate(value, fontSize),
) {
  const maxWidth = Math.max(1, ...gels.map(gel => gel.width));
  let baseW = 430;
  for (const gel of gels) {
    let pitch = fontSize * 1.8 + 8;
    for (const row of gel.conditions.filter(row => row.visible)) {
      const groups = row.groups?.length ? row.groups
        : row.values.map(label => ({label, span: Math.max(1, row.groupSize || 1)}));
      for (const group of groups) {
        // Long identifiers rotate instead of making the figure arbitrarily wide.
        pitch = Math.max(pitch, Math.min(fontSize * 3.2, measure(group.label) / Math.max(1, group.span)) + 8);
      }
    }
    const span = Math.max(0.01, (gel.laneSpan ?? 100) / 100);
    baseW = Math.max(baseW, pitch * Math.max(1, gel.lanes) / span * maxWidth / Math.max(1, gel.width));
  }
  const names = [...labels, ...gels.flatMap(gel => gel.conditions.filter(row => row.visible).map(row => row.name))];
  const nameSpace = Math.ceil(Math.max(0, ...names.map(measure))) + 28;
  return {maxWidth, baseW: Math.ceil(baseW),
    labelW: side === "antibody-right" ? 80 : Math.max(150, nameSpace),
    gap: side === "antibody-right" ? Math.max(110, nameSpace) : 110};
}

/** Matches cropData's integer canvas dimensions, without a minimum image height. */
export function figureCropHeight(artWidth: number, sourceWidth: number, sourceHeight: number, gelWidth: number, cropHeight: number) {
  return artWidth * Math.max(1, Math.round(sourceHeight * cropHeight / 100))
    / Math.max(1, Math.round(sourceWidth * gelWidth / 100));
}

export function figureMarkerBottom(imageBottom: number, top: number, count: number, fontSize: number) {
  return Math.max(imageBottom, top + fontSize + Math.max(0, count - 1) * (fontSize + 3) + 4);
}
