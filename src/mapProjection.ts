export type MapPoint = [number, number];
export type MapBounds = [number, number, number, number];

export type MapProjection = {
  readonly yScale: number;
  readonly transform?: string;
  point(point: MapPoint): MapPoint;
  y(y: number): number;
  span(span: MapPoint): MapPoint;
  bounds(bounds: MapBounds): MapBounds;
  path(path: string): string;
};

export function standardParallelYScale(standardParallel: number) {
  if (!Number.isFinite(standardParallel) || Math.abs(standardParallel) >= 90)
    throw new Error(
      'standardParallel must be a finite latitude between -90 and 90 degrees',
    );
  return 1 / Math.cos((standardParallel * Math.PI) / 180);
}

export function createMapProjection(
  standardParallel: number,
  centerY: number,
): MapProjection {
  const yScale = standardParallelYScale(standardParallel);
  const y = (value: number) => centerY + (value - centerY) * yScale;
  const point = ([x, pointY]: MapPoint): MapPoint => [x, y(pointY)];
  const span = ([width, height]: MapPoint): MapPoint => [
    width,
    height * yScale,
  ];
  const bounds = ([minX, minY, maxX, maxY]: MapBounds): MapBounds => [
    minX,
    y(minY),
    maxX,
    y(maxY),
  ];
  const path = (value: string) => {
    if (Math.abs(yScale - 1) <= Number.EPSILON) return value;
    return value.replace(
      /([ML])(-?[\d.]+),(-?[\d.]+)/g,
      (_match, command: string, x: string, pathY: string) =>
        `${command}${x},${Number(y(Number(pathY)).toFixed(4))}`,
    );
  };
  const transform =
    Math.abs(yScale - 1) <= Number.EPSILON
      ? undefined
      : `translate(0 ${centerY}) scale(1 ${yScale}) translate(0 ${-centerY})`;

  return { yScale, transform, point, y, span, bounds, path };
}

// Compatibility helpers remain useful for callers that need a single value.
export function standardParallelTransform(
  standardParallel: number,
  centerY: number,
) {
  return createMapProjection(standardParallel, centerY).transform;
}

export function projectYForStandardParallel(
  y: number,
  standardParallel: number,
  centerY: number,
) {
  return createMapProjection(standardParallel, centerY).y(y);
}
