// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import map from '../data/generated/map.json';
import {
  highlightedGeometryPaths,
  insetGeometryPaths,
  selectedInsetGeometryPaths,
} from './mapGeometry';
import { MapView } from './map/MapView';
import { quizOptions } from './contracts/quiz';
import { generatedLocations as locations } from './contracts/generatedData';
import { mapLayerForLocation, mapLayerForQuiz } from './quizMapBoundary';
import './styles.css';

const catalog = locations.filter(({ id }) => id.startsWith('iso:'));
const candidates = locations.filter(({ id }) => id.startsWith('non-un:'));
const quizLocations = locations.filter(({ id }) => id.startsWith('US-'));

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
  const active = locations.find((entry) => entry.id === id)!;
  const frame = document.createElement('section');
  frame.className = 'map-frame';
  document.body.append(frame);
  root = createRoot(frame);
  act(() =>
    root!.render(
      <MapView active={active} layer={mapLayerForLocation(active)} />,
    ),
  );
  return frame;
}

function renderState(id: string) {
  const active = quizLocations.find((entry) => entry.id === id)!;
  const quiz = quizOptions.find((entry) => entry.id === 'us-states')!;
  const frame = document.createElement('section');
  frame.className = 'map-frame';
  document.body.append(frame);
  root = createRoot(frame);
  act(() =>
    root!.render(
      <MapView active={active} layer={mapLayerForQuiz(quiz, active)} />,
    ),
  );
  return frame;
}

function expectActiveStatePaths(frame: HTMLElement, id: string) {
  const active = quizLocations.find((entry) => entry.id === id)!;
  const rendered = [...frame.querySelectorAll('.active-fill path')];
  expect(rendered.map((path) => path.getAttribute('d'))).toEqual(
    highlightedGeometryPaths(active.geometryRefs),
  );
  expect(
    rendered.every((path) => path.getAttribute('data-location-id') === id),
  ).toBe(true);
}

describe('mapped quiz layer contract', () => {
  it('renders semantic land and water classes in the main overlay and inset', () => {
    const land = renderLocation('world:europe');
    expect(land.querySelector('.active-fill .land-location')).toBeTruthy();

    act(() => root?.unmount());
    root = undefined;
    document.body.replaceChildren();
    const landCallout = renderState('US-RI');
    expect(
      landCallout.querySelector('.callout-selected.land-location'),
    ).toBeTruthy();

    act(() => root?.unmount());
    root = undefined;
    document.body.replaceChildren();

    const water = renderLocation('world:pacific-ocean');
    expect(water.querySelector('.active-fill .water-location')).toBeTruthy();
  });

  it('lets attempt colors override both untouched semantic defaults', () => {
    const frame = renderLocation('world:europe');
    frame.classList.add('active-player', 'attempts-remaining-2');
    expect(frame.querySelector('.active-fill .land-location')).toBeTruthy();
    const cssText = Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .map((rule) => rule.cssText)
      .join('\n');
    expect(cssText).toContain('.active-player.attempts-remaining-2');
    expect(cssText).toContain('--attempt-color: #facc15');

    act(() => root?.unmount());
    root = undefined;
    document.body.replaceChildren();

    const water = renderLocation('world:pacific-ocean');
    water.classList.add('active-player', 'attempts-remaining-2');
    expect(water.querySelector('.active-fill .water-location')).toBeTruthy();
    expect(cssText).toContain('.active-fill path.water-location');
  });

  it('keeps static geometry identity across active changes and equivalent layers', () => {
    const first = quizLocations.find((entry) => entry.id === 'US-RI')!;
    const second = quizLocations.find((entry) => entry.id === 'US-MA')!;
    const quiz = quizOptions.find((entry) => entry.id === 'us-states')!;
    const firstLayer = mapLayerForQuiz(quiz, first);
    let staticBuilds = 0;
    const observeStaticBuild = () => {
      staticBuilds += 1;
    };
    const frame = document.createElement('section');
    frame.className = 'map-frame';
    document.body.append(frame);
    root = createRoot(frame);
    act(() =>
      root!.render(
        <MapView
          active={first}
          layer={firstLayer}
          onStaticModelBuild={observeStaticBuild}
        />,
      ),
    );
    expect(staticBuilds).toBe(1);
    const staticPath = frame.querySelector('.countries path')!;
    const basePath = frame.querySelector('.map-base-layers path')!;
    const equivalentLayer = mapLayerForQuiz(quiz, second);
    expect(equivalentLayer).not.toBe(firstLayer);
    act(() =>
      root!.render(
        <MapView
          active={second}
          layer={equivalentLayer}
          onStaticModelBuild={observeStaticBuild}
        />,
      ),
    );
    expect(staticBuilds).toBe(1);
    expect(frame.querySelector('.countries path')).toBe(staticPath);
    expect(frame.querySelector('.map-base-layers path')).toBe(basePath);
    expect(frame.querySelector('.active-fill path')?.getAttribute('d')).toBe(
      highlightedGeometryPaths(second.geometryRefs)[0],
    );
    const changedContract = {
      ...equivalentLayer,
      geometryContractId: equivalentLayer.geometryContractId + ':changed',
    };
    act(() =>
      root!.render(
        <MapView
          active={second}
          layer={changedContract}
          onStaticModelBuild={observeStaticBuild}
        />,
      ),
    );
    expect(staticBuilds).toBe(2);
    expect(frame.querySelector('.countries path')).toBe(staticPath);
    expect(frame.querySelector('.map-base-layers path')).toBe(basePath);
    expect(
      frame.querySelector('.world-map')?.getAttribute('data-map-contract-id'),
    ).toBe(changedContract.geometryContractId);
  });

  it('renders configured context, selectable state target, and shared tiny callout', () => {
    const frame = renderState('US-RI');
    expect(frame.querySelector('.world-map')?.getAttribute('viewBox')).toBe(
      '-100 35 671.9444444444445 295',
    );
    expect(
      frame.querySelector('.world-map')?.getAttribute('preserveAspectRatio'),
    ).toBe('xMidYMid meet');
    expect(
      frame.querySelector('.map-projection')?.getAttribute('transform'),
    ).toContain('scale(1 1.269');
    expect(frame.querySelectorAll('.map-base-layers > g')).toHaveLength(51);
    expectActiveStatePaths(frame, 'US-RI');
    const geography = frame.querySelector('.map-projection');
    const callout = frame.querySelector('.map-callout');
    expect(callout).toBeTruthy();
    expect(geography?.contains(callout)).toBe(false);
    expect(
      frame
        .querySelector('.callout-inset-projection')
        ?.getAttribute('transform'),
    ).toBe(geography?.getAttribute('transform'));
    expect(frame.querySelector('.callout-selected')).toBeTruthy();
    expect(frame.querySelectorAll('.callout-context > .country')).toHaveLength(
      51,
    );
    expect(
      frame.querySelector('.callout-context [data-layer-id="US-MA"] path'),
    ).toBeTruthy();
    expect(
      frame.querySelector('.callout-context [data-layer-id="US-RI"] path'),
    ).toBeTruthy();
    const insetNeighborPaths = [
      ...frame.querySelectorAll(
        '.callout-context [data-layer-id="US-MA"] path',
      ),
    ].map((path) => path.getAttribute('d'));
    expect(insetNeighborPaths).toEqual(insetGeometryPaths('US-MA'));
    expect(insetNeighborPaths).not.toEqual(
      highlightedGeometryPaths(
        quizLocations.find((entry) => entry.id === 'US-MA')!.geometryRefs,
      ),
    );
    expect(
      frame.querySelectorAll('.callout-inset .callout-selected path').length,
    ).toBeGreaterThan(0);
    expect(
      [
        ...frame.querySelectorAll('.callout-inset .callout-selected path'),
      ].every((path) => path.getAttribute('d')),
    ).toBe(true);
    expect(frame.querySelectorAll('.countries .country').length).toBe(
      map.sourceFeatureIds.length - 1,
    );
  });

  it('keeps the shared large-region callout threshold bypass', () => {
    const frame = renderState('US-TX');
    expect(frame.querySelector('.map-callout')).toBeNull();
    expectActiveStatePaths(frame, 'US-TX');
  });
});

describe('MapView small-region callout rendering', () => {
  it('renders every custom target part in both the main map and magnified copy', () => {
    const active = candidates[0];
    const frame = document.createElement('section');
    frame.className = 'map-frame';
    document.body.append(frame);
    root = createRoot(frame);
    act(() =>
      root!.render(
        <MapView active={active} layer={mapLayerForLocation(active)} />,
      ),
    );

    const source = highlightedGeometryPaths(active.geometryRefs);
    const mainPaths = [...frame.querySelectorAll('.active-fill path')].map(
      (path) => path.getAttribute('d'),
    );
    const magnifiedPaths = [
      ...frame.querySelectorAll('.callout-selected path'),
    ].map((path) => path.getAttribute('d'));
    expect(active.id).toBe('non-un:abkhazia');
    expect(source.every((path) => mainPaths.includes(path))).toBe(true);
    const exactInsetPaths = selectedInsetGeometryPaths(
      active.id,
      active.geometryRefs,
    ).map(({ path }) => path);
    expect(exactInsetPaths.every((path) => magnifiedPaths.includes(path))).toBe(
      true,
    );
    expect(exactInsetPaths).not.toEqual(source);
  });

  it('uses the centered renderer bounds without distorting the projection', () => {
    const frame = renderLocation('iso:UZB');
    const worldMap = frame.querySelector('.world-map');
    expect(worldMap?.hasAttribute('preserveAspectRatio')).toBe(false);
    expect(worldMap?.getAttribute('viewBox')).toBe('-1428 0 1640 720');
    expect(
      worldMap?.querySelector('.map-projection')?.hasAttribute('transform'),
    ).toBe(false);
    expect(worldMap?.querySelector('rect.ocean')?.getAttribute('x')).toBe(
      '-1428',
    );
    const renderedCountryPaths = [
      ...worldMap!.querySelectorAll('g.countries path'),
    ];
    expect(renderedCountryPaths.every((path) => path.getAttribute('d'))).toBe(
      true,
    );
    expect(
      new Set(
        renderedCountryPaths.map((path) => path.getAttribute('transform')),
      ),
    ).toEqual(new Set(['translate(0 0)', 'translate(-1440 0)']));
  });

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

  it('uses the same source and cutout radii for every callout location', () => {
    const radii = ['iso:ATG', 'iso:VAT', 'iso:FJI'].map((id) => {
      const frame = renderLocation(id);
      return [
        frame.querySelector('.callout-source')?.getAttribute('r'),
        frame.querySelector('.callout-cutout')?.getAttribute('r'),
      ];
    });
    expect(new Set(radii.map(([source]) => source)).size).toBe(1);
    expect(new Set(radii.map(([, cutout]) => cutout)).size).toBe(1);
  });

  it('supplements sub-2px inset geometry with one dot without hiding the geometry', () => {
    const holySee = renderLocation('iso:VAT');
    expect(
      holySee.querySelectorAll('.callout-selected .inset-selected-polygon'),
    ).toHaveLength(1);
    expect(
      holySee.querySelectorAll('.callout-selected .inset-selected-dot'),
    ).toHaveLength(1);
    const dotRadius = Number(
      holySee
        .querySelector('.callout-selected .inset-selected-dot')
        ?.getAttribute('r'),
    );
    expect(dotRadius * (1440 / 1640) * 5 * 2).toBeCloseTo(2);

    const antigua = renderLocation('iso:ATG');
    expect(
      antigua.querySelectorAll('.callout-selected .inset-selected-polygon'),
    ).toHaveLength(3);
    expect(
      antigua.querySelectorAll('.callout-selected .inset-selected-dot'),
    ).toHaveLength(0);
  });

  it.each(['iso:ATG', 'iso:VAT', 'iso:ARM'])(
    'does not fabricate selected area for %s',
    (id) => {
      const frame = renderLocation(id);
      expect(frame.querySelectorAll('.callout-selected-point')).toHaveLength(0);
      expect(
        frame.querySelectorAll('.callout-selected .inset-selected-polygon'),
      ).toHaveLength(id === 'iso:VAT' ? 1 : id === 'iso:ATG' ? 3 : 2);
      expect(
        frame.querySelectorAll('.callout-selected .inset-selected-degenerate'),
      ).toHaveLength(0);
      expect(
        frame.querySelectorAll('.callout-selected path[fill-rule="evenodd"]'),
      ).toHaveLength(id === 'iso:VAT' ? 1 : id === 'iso:ATG' ? 3 : 2);
    },
  );
});
