// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import catalog from '../data/generated/catalog.json';
import { highlightedGeometryPaths } from './mapGeometry';
import { calloutLayout, MapView } from './main';

let root: ReturnType<typeof createRoot> | undefined;
class TestResizeObserver {
  observe() {}
  disconnect() {}
}

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});
beforeEach(() => vi.stubGlobal('ResizeObserver', TestResizeObserver));

function renderLocation(id: string) {
  const active = catalog.find((entry) => entry.id === id)!;
  const frame = document.createElement('section');
  frame.className = 'map-frame';
  document.body.append(frame);
  root = createRoot(frame);
  act(() => root!.render(<MapView active={active} />));
  return frame;
}

describe('MapView small-region callout rendering', () => {
  it.each([390, 1440])(
    'keeps the cutout compact and adjacent at a %dpx viewport',
    (viewportWidth) => {
      const renderedMapWidth = 1400;
      const sourceCenter: [number, number] = [700, 300];
      const sourceRadius = 10;
      const layout = calloutLayout(
        sourceCenter,
        sourceRadius,
        viewportWidth,
        renderedMapWidth,
      );
      const scale = viewportWidth / renderedMapWidth;
      expect(layout.radius * 2 * scale).toBeLessThanOrEqual(280);
      expect(Math.abs(layout.center[0] - sourceCenter[0]) * scale).toBeCloseTo(
        layout.radius * scale + sourceRadius * scale + 18,
      );
    },
  );

  it('keeps the source geometry unchanged and renders one contextual callout', () => {
    const frame = renderLocation('iso:ATG');
    const source = highlightedGeometryPaths(
      catalog.find((entry) => entry.id === 'iso:ATG')!.geometryRefs,
    );
    const rendered = [...frame.querySelectorAll('.active-fill path')].map(
      (path) => path.getAttribute('d'),
    );
    expect(rendered).toEqual(source);
    expect(frame.querySelectorAll('.callout-source')).toHaveLength(1);
    expect(frame.querySelectorAll('.callout-cutout')).toHaveLength(1);
    expect(frame.querySelectorAll('.callout-leader')).toHaveLength(2);
    expect(
      frame.querySelectorAll('.callout-context .country path').length,
    ).toBeGreaterThan(source.length);
    expect(
      frame.querySelector('.map-callout')?.getAttribute('aria-hidden'),
    ).toBe('true');
    expect(frame.querySelectorAll('[aria-label]').length).toBe(1);
  });

  it('bypasses callout graphics for a country with a large region', () => {
    const frame = renderLocation('iso:UZB');
    expect(frame.querySelector('.map-callout')).toBeNull();
    expect(frame.querySelectorAll('.callout-source')).toHaveLength(0);
    expect(frame.querySelectorAll('[aria-label]')).toHaveLength(1);
  });
});
