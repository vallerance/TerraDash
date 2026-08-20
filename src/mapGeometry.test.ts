import { describe, expect, it } from 'vitest';
import catalog from '../data/generated/catalog.json';
import candidates from '../data/generated/non-un-candidates.json';
import map from '../data/generated/map.json';
import inset from '../data/generated/inset.json';
import {
  baseGeometryPaths,
  highlightedGeometryPaths,
  classifyInsetGeometryPaths,
  insetGeometryPaths,
  selectedInsetGeometryPaths,
  tinyInsetDot,
} from './mapGeometry';
import { pathPoints } from './footprint';

describe('map geometry resolution', () => {
  it('renders each parent source feature once and excludes generated parts from the base layer', () => {
    expect(baseGeometryPaths()).toHaveLength(
      map.sourceFeatureIds.reduce(
        (count, id) =>
          count + map.features[id as keyof typeof map.features].paths.length,
        0,
      ),
    );
    expect(map.sourceFeatureIds.every((id) => !id.includes(':part:'))).toBe(
      true,
    );
  });
  it('renders exactly the reviewed active refs for a part override', () => {
    const palestine = catalog.find((item) => item.id === 'iso:PSE')!;
    const active = highlightedGeometryPaths(palestine.geometryRefs);
    expect(palestine.geometryRefs).toEqual([
      'ne:1159320899:part:0',
      'ne:1159320899:part:1',
    ]);
    expect(active).toHaveLength(2);
    expect(active).toEqual(
      palestine.geometryRefs.flatMap(
        (id) => map.features[id as keyof typeof map.features].paths,
      ),
    );
  });

  it('keeps the ordinary world map on 50m geometry while the inset resolves 10m geometry', () => {
    const atg = catalog.find((item) => item.id === 'iso:ATG')!;
    expect(highlightedGeometryPaths(atg.geometryRefs)).toEqual(
      atg.geometryRefs.flatMap(
        (id) => map.features[id as keyof typeof map.features].paths,
      ),
    );
    expect(insetGeometryPaths(atg.id)).toEqual(
      classifyInsetGeometryPaths(atg.id).map(({ path }) => path),
    );
    expect(selectedInsetGeometryPaths(atg.id, atg.geometryRefs)).toEqual(
      classifyInsetGeometryPaths(atg.id),
    );
    expect(insetGeometryPaths(atg.id).join('').length).toBeGreaterThan(
      highlightedGeometryPaths(atg.geometryRefs).join('').length,
    );
  });

  it('uses every custom map part when no high-resolution inset mapping exists', () => {
    const abkhazia = candidates[0];
    const selected = selectedInsetGeometryPaths(
      abkhazia.id,
      abkhazia.geometryRefs,
    );
    expect(abkhazia.id).toBe('non-un:abkhazia');
    expect(selected.map(({ path }) => path)).toEqual(
      highlightedGeometryPaths(abkhazia.geometryRefs),
    );
    expect(selected.every(({ kind }) => kind === 'polygon')).toBe(true);
  });

  it('retains explicit polygon/ring identity while classifying source geometry', () => {
    expect(
      classifyInsetGeometryPaths('iso:ATG').map(({ kind }) => kind),
    ).toEqual(['polygon', 'polygon', 'polygon']);
    expect(
      classifyInsetGeometryPaths('iso:VAT').map(({ kind }) => kind),
    ).toEqual(['polygon']);
    expect(
      classifyInsetGeometryPaths('iso:ARM').map(({ kind }) => kind),
    ).toEqual(['polygon', 'polygon']);
  });

  it('adds one 2px dot only when the largest inset region is below 2px', () => {
    const holySee = classifyInsetGeometryPaths('iso:VAT');
    expect(tinyInsetDot(holySee, (555 / 720) * 5)).toMatchObject({
      diameter: 2,
    });

    const [largest, smaller] = [
      { ...holySee[0], area: 2, span: [2, 2] as [number, number] },
      { ...holySee[0], area: 1, span: [0.1, 0.1] as [number, number] },
    ];
    expect(tinyInsetDot([largest, smaller], 1)).toBeUndefined();
    expect(tinyInsetDot([{ ...largest, span: [1.99, 4] }, smaller], 1)).toEqual(
      {
        center: largest.center,
        diameter: 2,
      },
    );
  });

  it('preserves exact 1:10m rings without generator-induced degenerates', () => {
    const atg = classifyInsetGeometryPaths('iso:ATG');
    expect(atg).toHaveLength(3);
    expect(atg.flatMap(({ ringIds }) => ringIds)).toHaveLength(3);
    expect(atg.every(({ kind }) => kind === 'polygon')).toBe(true);
    const fiji = inset.features['ne:1159320625'];
    expect(fiji.polygons).toHaveLength(44);
    expect(
      fiji.polygons
        .flatMap((polygon) => polygon.rings)
        .every((ring) => ring.valid),
    ).toBe(true);
    expect(
      fiji.polygons
        .flatMap((polygon) => polygon.rings)
        .some((ring) => ring.sourceVertexCount <= 3),
    ).toBe(false);
    const rings = Object.values(inset.features).flatMap((feature) =>
      feature.polygons.flatMap((polygon) => polygon.rings),
    );
    expect(rings).toHaveLength(4293);
    expect(rings.every((ring) => ring.sourceClosed)).toBe(true);
    expect(rings.every((ring) => ring.sourceValid)).toBe(true);
    expect(rings.every((ring) => ring.projectedValid)).toBe(true);
    expect(rings.every((ring) => !ring.generatorInducedDegenerate)).toBe(true);
    expect(
      rings.every(
        (ring) => pathPoints([ring.path]).length === ring.sourceVertexCount,
      ),
    ).toBe(true);
    expect(
      Object.values(inset.features).some((feature) =>
        feature.polygons.some((polygon) => polygon.island),
      ),
    ).toBe(true);
  });
});
