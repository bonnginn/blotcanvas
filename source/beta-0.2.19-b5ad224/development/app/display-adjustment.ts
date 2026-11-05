export type RawDisplayRange = {
  min: number;
  max: number;
  bitDepth: number;
  invert: boolean;
};

export const rawPercentileRange = (
  values: ArrayLike<number>,
  bitDepth: number,
  lowPercentile = 0.002,
  highPercentile = 0.998,
): RawDisplayRange => {
  const maximum = 2 ** bitDepth - 1,
    histogramSize = bitDepth <= 8 ? 256 : 4096,
    histogram = new Uint32Array(histogramSize);
  for (let index = 0; index < values.length; index++) {
    const bin = Math.max(
      0,
      Math.min(
        histogramSize - 1,
        Math.floor((values[index] / Math.max(1, maximum)) * (histogramSize - 1)),
      ),
    );
    histogram[bin]++;
  }
  const quantile = (fraction: number) => {
    const threshold = values.length * fraction;
    let total = 0;
    for (let index = 0; index < histogram.length; index++) {
      total += histogram[index];
      if (total >= threshold)
        return Math.round((index / (histogramSize - 1)) * maximum);
    }
    return maximum;
  };
  const min = quantile(lowPercentile);
  let max = quantile(highPercentile);
  if (max <= min) max = Math.min(maximum, min + Math.max(1, maximum / 255));
  return { min, max, bitDepth, invert: false };
};

export const mapRawToDisplay = (
  value: number,
  range: RawDisplayRange,
) => {
  const normalized = Math.max(
    0,
    Math.min(1, (value - range.min) / Math.max(1, range.max - range.min)),
  );
  const display = Math.round(normalized * 255);
  return range.invert ? 255 - display : display;
};

export const rawClipStatistics = (
  values: ArrayLike<number>,
  range: RawDisplayRange,
) => {
  let below = 0,
    above = 0,
    saturated = 0;
  const sourceMaximum = 2 ** range.bitDepth - 1;
  for (let index = 0; index < values.length; index++) {
    if (values[index] <= range.min) below++;
    if (values[index] >= range.max) above++;
    if (values[index] >= sourceMaximum) saturated++;
  }
  const denominator = Math.max(1, values.length);
  return {
    clippedLowPercent: (below / denominator) * 100,
    clippedHighPercent: (above / denominator) * 100,
    sourceSaturatedPercent: (saturated / denominator) * 100,
  };
};

export const adjustmentGroupKey = (antibody: string, bitDepth: number) =>
  `${antibody.trim()}\u0000${bitDepth}`;
