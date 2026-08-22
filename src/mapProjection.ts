export function standardParallelYScale(standardParallel: number) {
  if (!Number.isFinite(standardParallel) || Math.abs(standardParallel) >= 90)
    throw new Error(
      'standardParallel must be a finite latitude between -90 and 90 degrees',
    );
  return 1 / Math.cos((standardParallel * Math.PI) / 180);
}

export function projectYForStandardParallel(
  y: number,
  standardParallel: number,
  centerY: number,
) {
  const yScale = standardParallelYScale(standardParallel);
  return centerY + (y - centerY) * yScale;
}

/** Project only geographic SVG path coordinates, leaving overlay graphics untouched. */
export function projectPathForStandardParallel(
  path: string,
  standardParallel: number,
  centerY: number,
) {
  const yScale = standardParallelYScale(standardParallel);
  if (Math.abs(yScale - 1) <= Number.EPSILON) return path;
  return path.replace(
    /([ML])(-?[\d.]+),(-?[\d.]+)/g,
    (_match, command: string, x: string, y: string) => {
      const projectedY = projectYForStandardParallel(
        Number(y),
        standardParallel,
        centerY,
      );
      return `${command}${x},${Number(projectedY.toFixed(4))}`;
    },
  );
}
