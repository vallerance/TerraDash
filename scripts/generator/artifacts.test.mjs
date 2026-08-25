import { describe, expect, it } from 'vitest';
import {
  buildInsetArtifact,
  buildManifestArtifact,
  buildMapArtifact,
} from './artifacts.mjs';

describe('generator artifact seams', () => {
  it('assembles the map artifact without changing key ownership', () => {
    const feature = {
      id: 'ne:test',
      paths: ['M0,0Z'],
      anchor: [0, 0],
      bounds: [0, 0, 0, 0],
      parts: [],
    };
    expect(
      buildMapArtifact({
        width: 1440,
        height: 720,
        sourceUrl: 'source',
        sourceSha256: 'sha',
        features: [feature],
        playableSupplementalFeatures: [],
        playableLocationFeatureIds: { test: ['ne:test'] },
      }),
    ).toEqual({
      width: 1440,
      height: 720,
      source: {
        product: 'Natural Earth Admin 0 countries',
        version: 'v5.1.1',
        scale: '1:50m',
        url: 'source',
        sha256: 'sha',
        license: 'Public domain',
        disclaimer:
          'Boundaries are shown for gameplay visualization and do not imply endorsement of any boundary claim.',
      },
      sourceFeatureIds: ['ne:test'],
      supplementalFeatureIds: [],
      locationFeatureIds: { test: ['ne:test'] },
      features: {
        'ne:test': {
          paths: ['M0,0Z'],
          anchor: [0, 0],
          bounds: [0, 0, 0, 0],
          replacement: undefined,
        },
      },
    });
  });

  it('keeps deterministic provenance in the manifest seam', () => {
    const artifact = buildManifestArtifact({
      sourceSha256: 'sha',
      sourceUrl: 'source',
      supplementalSources: [],
      supplementalFeatures: [],
      map: { features: { a: {} } },
      insetSourceSha256: 'inset-sha',
      insetSourceUrl: 'inset-source',
      insetSource: { features: [{ properties: { NE_ID: 1 } }] },
      playableLocationFeatureIds: { test: ['ne:test'] },
    });

    expect(artifact).toMatchObject({
      sourceSha256: 'sha',
      generatedAt: 'deterministic',
      featureIds: ['a'],
      inset: { sourceSha256: 'inset-sha', featureIds: ['ne:1'] },
    });
  });

  it('assembles the inset artifact from resolved feature indexes', () => {
    expect(
      buildInsetArtifact({
        width: 1440,
        height: 720,
        sourceUrl: 'inset-source',
        sourceSha256: 'inset-sha',
        supplementalSources: [],
        insetFeatures: [
          {
            id: 'ne:test',
            paths: [],
            polygons: [],
            anchor: [1, 2],
            bounds: [0, 0, 1, 2],
          },
        ],
        insetLocationFeatures: { test: ['ne:test'] },
        supplementalInsetFeatures: [],
        locationsCount: 1,
      }),
    ).toMatchObject({
      width: 1440,
      height: 720,
      source: { url: 'inset-source', sha256: 'inset-sha' },
      selection: { catalogLocations: 1 },
      sourceFeatureIds: ['ne:test'],
      locationFeatureIds: { test: ['ne:test'] },
    });
  });
});
