import { describe, expect, it } from 'vitest';
import { derivePanelPlacement, unionRects } from './panelPlacement';

describe('derivePanelPlacement', () => {
  const panel = { width: 100, height: 60 };
  const map = { width: 400, height: 300 };

  it('prefers the top-left adjacent position when it fits', () => {
    expect(
      derivePanelPlacement(
        { left: 180, top: 150, width: 20, height: 20 },
        panel,
        map,
      ),
    ).toEqual({ left: 32, top: 42 });
  });
  it('chooses the opposite side when the preferred side is clipped', () => {
    expect(
      derivePanelPlacement(
        { left: 10, top: 150, width: 20, height: 20 },
        panel,
        map,
      ),
    ).toEqual({ left: 78, top: 42 });
  });
  it('clamps a panel larger than the available edge space', () => {
    expect(
      derivePanelPlacement(
        { left: 0, top: 0, width: 10, height: 10 },
        { width: 500, height: 400 },
        map,
      ),
    ).toEqual({ left: 0, top: 0 });
  });
  it('clamps using the autocomplete dropdown height instead of the form alone', () => {
    expect(
      derivePanelPlacement(
        { left: 180, top: 150, width: 20, height: 20 },
        { width: 100, height: 220 },
        map,
      ),
    ).toEqual({ left: 32, top: 0 });
  });
});

describe('unionRects', () => {
  it('returns the combined visible envelope of separate callout circles', () => {
    expect(
      unionRects([
        { left: 100, top: 120, width: 80, height: 80 },
        { left: 300, top: 100, width: 240, height: 240 },
      ]),
    ).toEqual({ left: 100, top: 100, width: 440, height: 240 });
  });

  it('returns undefined when no target rectangles are available', () => {
    expect(unionRects([])).toBeUndefined();
  });
});
