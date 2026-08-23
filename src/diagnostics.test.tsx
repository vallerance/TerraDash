// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import locations from '../data/generated/locations.json';
import reviewed from '../data/reviewed-invariants.json';
import { playableLocations } from './quizContracts';
import { DiagnosticsMap } from './diagnostics';

const catalog = locations.filter(({ id }) => id.startsWith('iso:'));
const candidates = locations.filter(({ id }) => id.startsWith('non-un:'));

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
    expect(new Set(playableLocations.map(({ id }) => id))).toEqual(
      new Set(reviewed.locationIds),
    );
    expect(new Set(candidates.map(({ id }) => id))).toEqual(
      new Set(reviewed.relationships.nonUnCandidateIds),
    );
  });
});
