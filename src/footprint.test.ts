// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import catalog from '../data/generated/catalog.json';
import map from '../data/generated/map.json';
import {
  componentSpan,
  COMPONENT_CLUSTER_PROXIMITY_PX,
  deriveComponentFootprints,
  deriveFootprint,
  mapXForLongitude,
  MAP_OVERLAP_REFERENCE_UNITS,
  MAP_SEAM_LONGITUDE,
  pathPoints,
  unwrapComponent,
  wrappedOffsets,
  wrappedPathOffsets,
} from './footprint';

describe('deriveFootprint', () => {
  it('uses true polygon at threshold', () =>
    expect(
      deriveFootprint([
        [0, 0],
        [10, 10],
      ]).kind,
    ).toBe('polygon'));
  it('adds a minimum footprint below threshold without changing source points', () => {
    const points: [number, number][] = [
      [5, 5],
      [6, 6],
    ];
    const result = deriveFootprint(points);
    expect(result.kind).toBe('circle');
    expect(result.radius).toBe(5);
    expect(points).toEqual([
      [5, 5],
      [6, 6],
    ]);
  });
  it('unwraps an antimeridian component to its local span', () => {
    expect(
      unwrapComponent(
        [
          [1, 0],
          [1439, 1],
        ],
        1440,
      ),
    ).toEqual([
      [1441, 0],
      [1439, 1],
    ]);
  });
  it.each([
    ['iso:FRA', true, true],
    ['iso:USA', true, true],
    ['iso:FJI', false, false],
    ['iso:PSE', false, false],
    ['iso:VAT', false, false],
    ['iso:ALB', true, false],
  ])(
    'uses local generated components for %s',
    (id, desktopPolygon, phonePolygon) => {
      const item = catalog.find((entry) => entry.id === id)!;
      const paths = item.geometryRefs.flatMap(
        (ref) => map.features[ref as keyof typeof map.features].paths,
      );
      const points = pathPoints(paths);
      expect(points.length).toBeGreaterThan(0);
      const desktop = deriveComponentFootprints(paths, 1, map.width);
      const phone = deriveComponentFootprints(paths, 0.25, map.width);
      expect(desktop.some((footprint) => footprint.kind === 'polygon')).toBe(
        desktopPolygon,
      );
      expect(phone.some((footprint) => footprint.kind === 'polygon')).toBe(
        phonePolygon,
      );
      expect(
        desktop.every((footprint) => footprint.radius <= map.width / 2),
      ).toBe(true);
      if (id === 'iso:FJI')
        expect(
          Math.max(...paths.map((path) => componentSpan(path, map.width))),
        ).toBeLessThan(100);
      if (id === 'iso:USA')
        expect(
          Math.max(...paths.map((path) => componentSpan(path, map.width))),
        ).toBeLessThan(600);
      expect(paths).toEqual(
        item.geometryRefs.flatMap(
          (ref) => map.features[ref as keyof typeof map.features].paths,
        ),
      );
    },
  );
  it('proves a reviewed plural source-component mapping', () => {
    const palestine = catalog.find((item) => item.id === 'iso:PSE');
    expect(palestine?.geometryRefs).toHaveLength(2);
    expect(palestine?.geometryRefs.every((ref) => ref.includes(':part:'))).toBe(
      true,
    );
  });
});

describe('screen-space component clustering', () => {
  const small = (x: number) => `M${x},0L${x + 2},2Z`;

  it('clusters transitively in CSS pixels', () => {
    const result = deriveComponentFootprints(
      [small(0), small(15), small(30)],
      1,
      1440,
      10,
      16,
    );
    expect(result).toHaveLength(1);
    expect(result[0].center).toEqual([1, 1]);
  });

  it('suppresses all assists when a native-large component is nearby', () => {
    const result = deriveComponentFootprints(
      ['M0,0L20,0L20,20Z', small(25)],
      1,
      1440,
      10,
      24,
    );
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('polygon');
  });

  it('uses one deterministic largest-anchor assist for an all-small cluster', () => {
    const result = deriveComponentFootprints(
      ['M0,0L2,2Z', 'M12,0L15,3Z', 'M40,0L42,2Z'],
      1,
      1440,
      10,
      COMPONENT_CLUSTER_PROXIMITY_PX,
    );
    expect(result).toHaveLength(2);
    expect(result[0].center).toEqual([13.5, 1.5]);
  });
});

describe('wrapped screen-space alignment', () => {
  const seamX = mapXForLongitude(MAP_SEAM_LONGITUDE, 1440);

  it('projects the configurable 170W seam to the reference map', () => {
    expect(seamX).toBe(40);
  });

  it('scales the 100-reference-unit overlap with the responsive map', () => {
    expect(MAP_OVERLAP_REFERENCE_UNITS * 0.5).toBe(50);
    expect(MAP_OVERLAP_REFERENCE_UNITS * 2).toBe(200);
    const responsiveSeam = mapXForLongitude(MAP_SEAM_LONGITUDE, 720);
    expect(wrappedOffsets(90, 110, 720, responsiveSeam)).toEqual([-20, 590]);
  });

  it('duplicates Hawaii at both edges from one source geometry', () => {
    expect(wrappedOffsets(90, 110, 1440, seamX)).toEqual([-40, 1290]);
    const usaSourcePaths = map.features['ne:1159321369'].paths;
    expect(
      usaSourcePaths.filter(
        (path) => wrappedPathOffsets([path], 1440, seamX).length === 2,
      ).length,
    ).toBeGreaterThan(0);
    expect(wrappedOffsets(500, 520, 1440, seamX)).toEqual([-40]);
  });

  it('keeps a non-overlapping feature single', () => {
    expect(wrappedOffsets(500, 600, 1440, seamX)).toEqual([-40]);
  });

  it('uses the same edge copies for active geometry and its footprint', () => {
    const bounds = [90, 110] as const;
    expect(
      wrappedPathOffsets([`M${bounds[0]},0L${bounds[1]},10Z`], 1440, seamX),
    ).toEqual(wrappedOffsets(bounds[0], bounds[1], 1440, seamX));
  });

  it('proves two visible DOM copies and one semantic label', () => {
    const sourcePath = 'M90,100L110,100L110,120L90,120Z';
    const label = document.createElement('span');
    label.setAttribute('aria-label', 'Hawaii');
    document.body.append(label);
    const copies = wrappedOffsets(90, 110, 1440, seamX).map((transform) => {
      const path = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path',
      );
      path.setAttribute('d', sourcePath);
      path.setAttribute('transform', `translate(${transform} 0)`);
      path.setAttribute('aria-hidden', 'true');
      document.body.append(path);
      return path;
    });
    const bounds = copies.map((path) => {
      const transform = Number(
        path.getAttribute('transform')!.match(/-?[0-9.]+/)![0],
      );
      const xs = pathPoints([sourcePath]).map(([x]) => x + transform);
      return [Math.min(...xs), Math.max(...xs)];
    });
    expect(bounds).toEqual([
      [50, 70],
      [1380, 1400],
    ]);
    expect(bounds.every(([min, max]) => min >= 0 && max <= 1440)).toBe(true);
    expect(document.querySelectorAll('[aria-label="Hawaii"]')).toHaveLength(1);
    expect(document.querySelectorAll('path[aria-hidden="true"]')).toHaveLength(
      2,
    );
    document.body.replaceChildren();
  });
});
