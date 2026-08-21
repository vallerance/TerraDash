import { describe, expect, it } from 'vitest';
import { MAP_ASPECT_RATIO, mapWidthForStage } from './mapLayout';

describe('map stage sizing', () => {
  it('uses available width when the stage is tall enough', () => {
    expect(mapWidthForStage(1200, 900)).toBe(1200);
  });

  it('uses available height when the stage is too short', () => {
    const width = mapWidthForStage(1200, 300);
    expect(width).toBe(300 * MAP_ASPECT_RATIO);
    expect(width / MAP_ASPECT_RATIO).toBe(300);
  });
});
