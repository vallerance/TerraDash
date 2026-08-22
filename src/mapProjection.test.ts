import { describe, expect, it } from 'vitest';
import {
  projectPathForStandardParallel,
  projectYForStandardParallel,
  standardParallelYScale,
} from './mapProjection';

describe('equirectangular standard parallel rendering', () => {
  it('keeps Plate Carree as the zero-degree default', () => {
    expect(standardParallelYScale(0)).toBe(1);
    expect(projectYForStandardParallel(200, 0, 360)).toBe(200);
    expect(projectPathForStandardParallel('M10,20L30,40Z', 0, 30)).toBe(
      'M10,20L30,40Z',
    );
  });

  it('projects geographic path coordinates without scaling overlay geometry', () => {
    const path = projectPathForStandardParallel('M10,100L30,300Z', 38, 200);
    const expectedTop = projectYForStandardParallel(100, 38, 200);
    const expectedBottom = projectYForStandardParallel(300, 38, 200);
    expect(path).toBe(
      `M10,${Number(expectedTop.toFixed(4))}L30,${Number(expectedBottom.toFixed(4))}Z`,
    );
    expect(standardParallelYScale(38)).toBeCloseTo(
      1 / Math.cos((38 * Math.PI) / 180),
    );
  });

  it('rejects invalid standard parallels', () => {
    expect(() => standardParallelYScale(90)).toThrow();
    expect(() => standardParallelYScale(Number.NaN)).toThrow();
  });
});
