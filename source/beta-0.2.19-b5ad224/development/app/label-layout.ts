export type AutoLabelLayout = {
  mode: "single" | "wrap" | "rotate";
  lines: string[];
  fontScale: number;
};

export const labelWidthEstimate = (value: string, fontSize: number) =>
  [...value].reduce(
    (width, char) =>
      width +
      fontSize *
        (/[\u3000-\u9fff\uff01-\uff60]/.test(char) ? 1 : 0.56),
    0,
  );

// Conservative glyph widths for scientific figure labels across the supported fonts.
export const figureLabelWidthEstimate = (value: string, fontSize: number) => [...value].reduce((width, char) =>
  width + fontSize * (/[\u3000-\u9fff\uff01-\uff60MW@%]/.test(char) ? 1 : 0.66), 0);

const splitAtNaturalBoundaries = (value: string, lineCount: number, preserveIdentifiers = false) => {
  const boundaries = [...value.matchAll(preserveIdentifiers ? /[\s・]+/g : /[\s・,_/]+/g)]
      .map((match) => (match.index || 0) + match[0].length)
      .filter((index) => index > 0 && index < value.length),
    lines: string[] = [];
  if (boundaries.length < lineCount - 1) return [];
  let start = 0;
  for (let line = 1; line < lineCount; line++) {
    const candidates = boundaries.filter(
        (boundary, index) =>
          boundary > start &&
          boundaries.length - index >= lineCount - line,
      ),
      target = (value.length * line) / lineCount,
      bestIndex = candidates.sort(
        (a, b) => Math.abs(a - target) - Math.abs(b - target),
      )[0];
    if (!bestIndex) return [];
    lines.push(value.slice(start, bestIndex).trim());
    start = bestIndex;
  }
  lines.push(value.slice(start).trim());
  return lines.filter(Boolean);
};

/**
 * Keep lane labels horizontal whenever they remain readable. Rotation is a
 * last resort because a single long value otherwise forces an entire row to
 * rotate and makes dense experimental condition tables hard to follow.
 */
export const autoLabelLayout = (
  value: string,
  availableWidth: number,
  fontSize: number,
  preserveIdentifiers = false,
): AutoLabelLayout => {
  if (!value)
    return { mode: "single", lines: [value], fontScale: 1 };
  const safeWidth = Math.max(4, availableWidth),
    widthOf = preserveIdentifiers ? figureLabelWidthEstimate : labelWidthEstimate,
    scales = [1, 0.9];
  for (const fontScale of scales) {
    const effectiveSize = fontSize * fontScale;
    if (widthOf(value, effectiveSize) <= safeWidth)
      return { mode: "single", lines: [value], fontScale };
    for (const lineCount of [2, 3]) {
      const lines = splitAtNaturalBoundaries(value, lineCount, preserveIdentifiers);
      if (
        lines.length === lineCount &&
        Math.max(...lines.map((line) => widthOf(line, effectiveSize))) <=
          safeWidth
      )
        return { mode: "wrap", lines, fontScale };
    }
  }
  return { mode: "rotate", lines: [value], fontScale: 0.9 };
};

/** Bottom-align a gel's condition rows to the shared blot-image top. */
export const conditionRowsStart = (imageTop: number, rowHeights: number[]) =>
  imageTop - rowHeights.reduce((total, height) => total + height, 0);
