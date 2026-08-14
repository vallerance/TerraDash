import { describe, expect, it } from 'vitest';
// @vitest-environment jsdom
import {
  derivePanelPlacement,
  panelPlacementTargets,
  unionRects,
} from './panelPlacement';

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

describe('panelPlacementTargets', () => {
  it('uses only highlighted geometry when there is no callout', () => {
    const stage = document.createElement('div');
    stage.innerHTML = '<svg><g class="active-fill"></g></svg>';
    const targets = panelPlacementTargets(stage);
    expect(targets).toHaveLength(1);
    expect(targets[0]?.classList.contains('active-fill')).toBe(true);
  });

  it('uses the combined callout envelope when both circles render', () => {
    const stage = document.createElement('div');
    stage.innerHTML = `
      <svg>
        <g class="active-fill"></g>
        <g class="map-callout">
          <circle class="callout-source"></circle>
          <circle class="callout-cutout"></circle>
          <line class="callout-leader"></line>
        </g>
      </svg>`;
    const targets = panelPlacementTargets(stage);
    expect(targets.map((target) => target.className.baseVal)).toEqual([
      'callout-source',
      'callout-cutout',
    ]);
  });
});

describe('unionRects', () => {
  it('returns the envelope containing both callout circles', () => {
    expect(
      unionRects([
        { left: 20, top: 30, width: 40, height: 40 },
        { left: 132, top: 12, width: 100, height: 100 },
      ]),
    ).toEqual({ left: 20, top: 12, width: 212, height: 100 });
  });
});
