import { describe, expect, it } from 'vitest';
import {
  MAP_ASPECT_RATIO,
  mapWidthForStage,
  US_STATES_MAP_ASPECT_RATIO,
} from './mapLayout';

describe('map stage sizing', () => {
  it('uses available width when the stage is tall enough', () => {
    expect(mapWidthForStage(1200, 900)).toBe(1200);
  });

  it('uses available height when the stage is too short', () => {
    const width = mapWidthForStage(1200, 300);
    expect(width).toBe(300 * MAP_ASPECT_RATIO);
    expect(width / MAP_ASPECT_RATIO).toBe(300);
  });

  it('uses the regional viewBox ratio when sizing the US States map', () => {
    const width = mapWidthForStage(1200, 300, US_STATES_MAP_ASPECT_RATIO);
    expect(width).toBe(300 * US_STATES_MAP_ASPECT_RATIO);
    expect(width / US_STATES_MAP_ASPECT_RATIO).toBe(300);
  });
});
