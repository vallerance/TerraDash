// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import catalog from '../data/generated/catalog.json';
import { highlightedGeometryPaths } from './mapGeometry';
import { MapView } from './main';

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
    const sourceCenter = frame
      .querySelector('.callout-source')
      ?.getAttribute('cx');
    expect(sourceCenter).toBeTruthy();
    const sourceCircle = frame.querySelector('.callout-source')!;
    const sourceX = Number(sourceCircle.getAttribute('cx'));
    const sourceY = Number(sourceCircle.getAttribute('cy'));
    const sourceRadius = Number(sourceCircle.getAttribute('r'));
    const leader = frame.querySelector('.callout-leader')!;
    expect(
      Math.hypot(
        Number(leader.getAttribute('x1')) - sourceX,
        Number(leader.getAttribute('y1')) - sourceY,
      ),
    ).toBeCloseTo(sourceRadius);
    expect(frame.querySelector('.callout-inset')).toBeTruthy();
    expect(
      frame.querySelector('.callout-inset')?.getAttribute('viewBox'),
    ).toBeTruthy();
    expect(frame.querySelector('.callout-cutout')).toBeTruthy();
    expect(
      frame.querySelectorAll('.callout-inset .country path').length,
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

  it.each(['iso:ATG', 'iso:VAT', 'iso:ARM'])(
    'does not fabricate selected area for %s',
    (id) => {
      const frame = renderLocation(id);
      expect(frame.querySelectorAll('.callout-selected-point')).toHaveLength(0);
      expect(
        frame.querySelectorAll('.callout-selected .inset-selected-polygon'),
      ).toHaveLength(id === 'iso:VAT' ? 0 : 2);
      expect(
        frame.querySelectorAll('.callout-selected .inset-selected-degenerate')
          .length,
      ).toBeGreaterThanOrEqual(id === 'iso:VAT' ? 1 : 0);
      expect(
        [...frame.querySelectorAll('.callout-selected path')].every(
          (path) => !path.getAttribute('fill') && !path.getAttribute('stroke'),
        ),
      ).toBe(true);
    },
  );
});
