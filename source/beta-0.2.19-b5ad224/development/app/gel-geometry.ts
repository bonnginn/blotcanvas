export type NormalizedPoint = { x: number; y: number };

export type NormalizedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const rotatePoint = (
  point: NormalizedPoint,
  angleDegrees: number,
  imageWidth: number,
  imageHeight: number,
): NormalizedPoint => {
  const radians = (angleDegrees * Math.PI) / 180,
    cosine = Math.cos(radians),
    sine = Math.sin(radians),
    pixelX = ((point.x - 50) / 100) * imageWidth,
    pixelY = ((point.y - 50) / 100) * imageHeight;
  return {
    x:
      50 +
      ((pixelX * cosine - pixelY * sine) / Math.max(1, imageWidth)) * 100,
    y:
      50 +
      ((pixelX * sine + pixelY * cosine) / Math.max(1, imageHeight)) * 100,
  };
};

/** Converts a point in the corrected (rotated) view back to the source image. */
export const correctedPointToSource = (
  point: NormalizedPoint,
  angleDegrees: number,
  imageWidth: number,
  imageHeight: number,
) => rotatePoint(point, -angleDegrees, imageWidth, imageHeight);

/** Converts a source-image point to the corrected (rotated) view. */
export const sourcePointToCorrected = (
  point: NormalizedPoint,
  angleDegrees: number,
  imageWidth: number,
  imageHeight: number,
) => rotatePoint(point, angleDegrees, imageWidth, imageHeight);

export const correctedRectSourceCorners = (
  rect: NormalizedRect,
  angleDegrees: number,
  imageWidth: number,
  imageHeight: number,
): NormalizedPoint[] =>
  [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ].map((point) =>
    correctedPointToSource(point, angleDegrees, imageWidth, imageHeight),
  );

export const pointInPolygon = (
  point: NormalizedPoint,
  polygon: NormalizedPoint[],
) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j],
      crosses =
        a.y > point.y !== b.y > point.y &&
        point.x <
          ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || Number.EPSILON) +
            a.x;
    if (crosses) inside = !inside;
  }
  return inside;
};
