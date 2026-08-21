import { describe, expect, it } from 'vitest';
import {
  projectYForStandardParallel,
  standardParallelTransform,
  standardParallelYScale,
} from './mapProjection';

describe('equirectangular standard parallel rendering', () => {
  it('keeps Plate Carree as the zero-degree default', () => {
    expect(standardParallelYScale(0)).toBe(1);
    expect(standardParallelTransform(0, 360)).toBeUndefined();
    expect(projectYForStandardParallel(200, 0, 360)).toBe(200);
  });

  it('uses the secant of the standard parallel as the equivalent north-south scale', () => {
    expect(standardParallelYScale(38)).toBeCloseTo(1 / Math.cos((38 * Math.PI) / 180));
    expect(projectYForStandardParallel(100, 38, 200)).toBeLessThan(100);
    expect(projectYForStandardParallel(300, 38, 200)).toBeGreaterThan(300);
  });

  it('rejects invalid standard parallels', () => {
    expect(() => standardParallelYScale(90)).toThrow();
    expect(() => standardParallelYScale(Number.NaN)).toThrow();
  });
});
