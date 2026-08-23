import { describe, expect, it } from 'vitest';
import { createMapProjection, standardParallelYScale } from './mapProjection';

describe('equirectangular standard parallel rendering', () => {
  it('keeps Plate Carree as the zero-degree default', () => {
    const projection = createMapProjection(0, 360);
    expect(projection.yScale).toBe(1);
    expect(projection.transform).toBeUndefined();
    expect(projection.point([10, 200])).toEqual([10, 200]);
    expect(projection.path('M10,20L30,40Z')).toBe('M10,20L30,40Z');
  });

  it('provides map coordinates that match the group-level transform', () => {
    const projection = createMapProjection(38, 200);
    const yScale = 1 / Math.cos((38 * Math.PI) / 180);
    const top = 200 + (100 - 200) * yScale;
    const bottom = 200 + (300 - 200) * yScale;

    expect(projection.yScale).toBeCloseTo(yScale);
    expect(projection.transform).toContain(`scale(1 ${yScale})`);
    expect(projection.point([10, 100])).toEqual([10, top]);
    expect(projection.span([30, 40])).toEqual([30, 40 * yScale]);
    expect(projection.bounds([10, 100, 30, 300])).toEqual([
      10,
      top,
      30,
      bottom,
    ]);
    expect(projection.path('M10,100L30,300Z')).toBe(
      `M10,${Number(top.toFixed(4))}L30,${Number(bottom.toFixed(4))}Z`,
    );
  });

  it('rejects invalid standard parallels', () => {
    expect(() => standardParallelYScale(90)).toThrow();
    expect(() => createMapProjection(Number.NaN, 0)).toThrow();
  });
});
