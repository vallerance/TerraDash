// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import catalog from '../data/generated/catalog.json';
import candidates from '../data/generated/non-un-candidates.json';
import { playableLocations } from './quizContracts';
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
  it('renders the real catalog map content for the shared shell', () => {
    const host = document.createElement('main');
    document.body.append(host);
    root = createRoot(host);
    act(() => root!.render(<DiagnosticsMap location={catalog[0]} />));

    expect(host.querySelector('.world-map')).toBeTruthy();
    expect(host.querySelector('.map-stage')).toBeNull();
    expect(host.querySelector('.answer-panel')).toBeNull();
    expect(host.querySelector('.diagnostics-card')).toBeNull();
  });

  it('keeps diagnostics coverage aligned with every playable location', () => {
    expect(playableLocations).toHaveLength(336);
    expect(new Set(playableLocations.map(({ id }) => id)).size).toBe(336);
    expect(candidates).toHaveLength(91);
  });
});
