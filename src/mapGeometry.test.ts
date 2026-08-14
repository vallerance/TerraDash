import { describe, expect, it } from 'vitest';
import catalog from '../data/generated/catalog.json';
import map from '../data/generated/map.json';
import inset from '../data/generated/inset.json';
import {
  baseGeometryPaths,
  highlightedGeometryPaths,
  classifyInsetGeometryPaths,
  insetGeometryPaths,
} from './mapGeometry';

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
      inset.locationFeatureIds[
        atg.id as keyof typeof inset.locationFeatureIds
      ].flatMap(
        (id) => inset.features[id as keyof typeof inset.features].paths,
      ),
    );
    expect(insetGeometryPaths(atg.id).join('').length).toBeGreaterThan(
      highlightedGeometryPaths(atg.geometryRefs).join('').length,
    );
  });

  it('retains inset path identity while classifying polygon and degenerate artifacts', () => {
    expect(
      classifyInsetGeometryPaths('iso:ATG').map(({ kind }) => kind),
    ).toEqual(['polygon', 'artifact', 'degenerate']);
    expect(
      classifyInsetGeometryPaths('iso:VAT').map(({ kind }) => kind),
    ).toEqual(['degenerate']);
    expect(
      classifyInsetGeometryPaths('iso:ARM').map(({ kind }) => kind),
    ).toEqual(['polygon', 'degenerate', 'degenerate', 'polygon']);
  });

  it('keeps valid polygon fill while isolating the reviewed malformed ATG ring', () => {
    const atg = classifyInsetGeometryPaths('iso:ATG');
    expect(atg.filter(({ kind }) => kind === 'polygon')).toHaveLength(1);
    expect(atg.filter(({ kind }) => kind === 'artifact')).toHaveLength(1);
    expect(atg.filter(({ kind }) => kind === 'degenerate')).toHaveLength(1);
    expect(
      classifyInsetGeometryPaths('iso:VAT').every(
        ({ kind }) => kind === 'degenerate',
      ),
    ).toBe(true);
  });
});
