export function standardParallelYScale(standardParallel: number) {
  if (!Number.isFinite(standardParallel) || Math.abs(standardParallel) >= 90)
    throw new Error(
      'standardParallel must be a finite latitude between -90 and 90 degrees',
    );
  return 1 / Math.cos((standardParallel * Math.PI) / 180);
}

export function standardParallelTransform(
  standardParallel: number,
  centerY: number,
): string | undefined {
  const yScale = standardParallelYScale(standardParallel);
  if (Math.abs(yScale - 1) <= Number.EPSILON) return undefined;
  return `translate(0 ${centerY}) scale(1 ${yScale}) translate(0 ${-centerY})`;
}

export function projectYForStandardParallel(
  y: number,
  standardParallel: number,
  centerY: number,
) {
  const yScale = standardParallelYScale(standardParallel);
  return centerY + (y - centerY) * yScale;
}
