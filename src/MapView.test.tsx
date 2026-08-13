// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import catalog from '../data/generated/catalog.json';
import map from '../data/generated/map.json';
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

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', TestResizeObserver);
});

function renderLocation(id: string) {
  const active = catalog.find((entry) => entry.id === id)!;
  const frame = document.createElement('section');
  frame.className = 'map-frame';
  document.body.append(frame);
  root = createRoot(frame);
  act(() => {
    root!.render(<MapView active={active} />);
  });
  return frame;
}

describe('MapView minimum geometry rendering', () => {
  it('enlarges separated all-small geometry and renders one enclosing assist', () => {
    const frame = renderLocation('iso:ATG');
    const source = highlightedGeometryPaths(
      catalog.find((entry) => entry.id === 'iso:ATG')!.geometryRefs,
    );
    const rendered = [...frame.querySelectorAll('.active-fill path')].map(
      (path) => path.getAttribute('d'),
    );
    expect(rendered).not.toEqual(source);
    expect(frame.querySelectorAll('.minimum-footprint')).toHaveLength(1);
    expect(
      Number(frame.querySelector('.minimum-footprint')?.getAttribute('r')),
    ).toBeGreaterThanOrEqual(5);
  });

  it('keeps native-containing geometry unchanged and emits no assist', () => {
    const frame = renderLocation('iso:UZB');
    const source = highlightedGeometryPaths(
      catalog.find((entry) => entry.id === 'iso:UZB')!.geometryRefs,
    );
    const rendered = [...frame.querySelectorAll('.active-fill path')].map(
      (path) => path.getAttribute('d'),
    );
    expect(rendered).toEqual(source);
    expect(frame.querySelectorAll('.minimum-footprint')).toHaveLength(0);
    expect(frame.querySelector('svg')?.getAttribute('aria-label')).toContain(
      'selected location',
    );
    expect(map.width).toBeGreaterThan(0);
  });
});
