// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapBoxShell } from './MapBoxShell';

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

describe('MapBoxShell shared map-box contract', () => {
  it('keeps the stage, slot, frame, map, and optional overlay order stable', () => {
    const host = document.createElement('main');
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root!.render(
        <MapBoxShell
          prompt={<div className="quiz-prompt">Prompt</div>}
          status={<div className="status-item">Status</div>}
          content={<svg className="world-map" aria-label="test map" />}
          stageOverlay={<div className="answer-panel" data-testid="overlay" />}
        />,
      ),
    );

    const stage = host.querySelector('.map-stage')!;
    expect(
      stage.querySelector(':scope > .map-slot.full-bleed-map'),
    ).toBeTruthy();
    expect(
      stage.querySelector(':scope > .map-slot > .map-frame > .world-map'),
    ).toBeTruthy();
    expect(stage.lastElementChild?.getAttribute('data-testid')).toBe('overlay');
  });

  it('uses the same resize-driven sizing contract for every consumer', () => {
    const host = document.createElement('main');
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root!.render(
        <>
          <MapBoxShell
            prompt={<div>Prompt</div>}
            status={<div>Status</div>}
            content={<svg className="world-map" />}
          />
          <MapBoxShell
            prompt={<div>Prompt</div>}
            status={<div>Status</div>}
            content={<svg className="world-map" />}
          />
        </>,
      ),
    );

    const stages = [...host.querySelectorAll<HTMLElement>('.map-stage')];
    expect(stages).toHaveLength(2);
    expect(
      stages.map((stage) => stage.querySelector('.map-slot')?.className),
    ).toEqual(['map-slot full-bleed-map', 'map-slot full-bleed-map']);
    expect(
      stages.map((stage) => stage.querySelector('.map-frame')?.className),
    ).toEqual(['map-frame', 'map-frame']);
  });

  it('keeps header overlays outside the shell header flow', () => {
    const host = document.createElement('main');
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root!.render(
        <MapBoxShell
          prompt={<div>Prompt</div>}
          status={<div>Status</div>}
          content={<svg className="world-map" />}
          headerOverlay={<label data-testid="header-control">Control</label>}
        />,
      ),
    );

    const header = host.querySelector('.quiz-header')!;
    const overlay = host.querySelector('.map-header-overlay')!;
    expect(overlay.parentElement).toBe(header);
    expect(overlay.firstElementChild?.getAttribute('data-testid')).toBe(
      'header-control',
    );
    expect(overlay.className).toBe('map-header-overlay');
  });
});
