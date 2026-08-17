// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import catalog from '../data/generated/catalog.json';
import { DiagnosticsMap } from './diagnostics';

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

describe('DiagnosticsMap consumer contract', () => {
  it('uses the shared stage-to-map-box structure for a real catalog location', () => {
    const host = document.createElement('main');
    document.body.append(host);
    root = createRoot(host);
    act(() => root!.render(<DiagnosticsMap location={catalog[0]} />));

    expect(host.querySelector('.map-stage')).toBeTruthy();
    expect(
      host.querySelector(
        '.map-stage > .map-slot.full-bleed-map > .map-frame > .world-map',
      ),
    ).toBeTruthy();
    expect(host.querySelector('.answer-panel')).toBeNull();
    expect(host.querySelector('.diagnostics-card')).toBeNull();
  });
});
