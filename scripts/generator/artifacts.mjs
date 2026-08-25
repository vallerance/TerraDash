export function buildMapArtifact({
  width,
  height,
  sourceUrl,
  sourceSha256,
  features,
  playableSupplementalFeatures,
  playableLocationFeatureIds,
}) {
  return {
    width,
    height,
    source: {
      product: 'Natural Earth Admin 0 countries',
      version: 'v5.1.1',
      scale: '1:50m',
      url: sourceUrl,
      sha256: sourceSha256,
      license: 'Public domain',
      disclaimer:
        'Boundaries are shown for gameplay visualization and do not imply endorsement of any boundary claim.',
    },
    sourceFeatureIds: features.map((feature) => feature.id),
    supplementalFeatureIds: playableSupplementalFeatures.map(
      (feature) => feature.id,
    ),
    locationFeatureIds: playableLocationFeatureIds,
    features: Object.fromEntries(
      [...features, ...playableSupplementalFeatures].flatMap(
        ({ id, paths, anchor, bounds, replacement, parts = [] }) => [
          [id, { paths, anchor, bounds, replacement }],
          ...parts.map(
            ({
              id: partId,
              paths: partPaths,
              anchor: partAnchor,
              bounds: partBounds,
            }) => [
              partId,
              { paths: partPaths, anchor: partAnchor, bounds: partBounds },
            ],
          ),
        ],
      ),
    ),
  };
}

export function buildManifestArtifact({
  sourceSha256,
  sourceUrl,
  supplementalSources,
  supplementalFeatures,
  map,
  insetSourceSha256,
  insetSourceUrl,
  insetSource,
  playableLocationFeatureIds,
}) {
  return {
    sourceSha256,
    sourceUrl,
    supplementalSources,
    geometrySourceReplacements: supplementalFeatures
      .filter(({ replacement }) => replacement)
      .map(({ id, replacement }) => ({ id, ...replacement })),
    generatedAt: 'deterministic',
    featureIds: Object.keys(map.features),
    locations: playableLocationFeatureIds,
    inset: {
      sourceSha256: insetSourceSha256,
      sourceUrl: insetSourceUrl,
      artifact: 'data/generated/inset.json',
      featureIds: insetSource.features.map(
        (feature) => `ne:${feature.properties.NE_ID}`,
      ),
    },
  };
}

export function buildInsetArtifact({
  width,
  height,
  sourceUrl,
  sourceSha256,
  supplementalSources,
  insetFeatures,
  insetLocationFeatures,
  supplementalInsetFeatures,
  locationsCount,
}) {
  return {
    width,
    height,
    source: {
      product:
        'Natural Earth Admin 0 countries plus supplemental Admin-1/map-unit/map-subunit regions',
      version: 'v5.1.1',
      scale: '1:10m',
      url: sourceUrl,
      sha256: sourceSha256,
      supplementalSources,
      license: 'Public domain',
      disclaimer:
        'Inset boundaries are shown for gameplay visualization and do not imply endorsement of any boundary claim.',
    },
    selection: {
      rule: 'all configured quiz locations plus every exact supplemental feature referenced by a configured location',
      catalogLocations: locationsCount,
      neighborPaddingProjectedUnits: 24,
    },
    sourceFeatureIds: insetFeatures.map((feature) => feature.id),
    locationFeatureIds: insetLocationFeatures,
    features: Object.fromEntries(
      [...insetFeatures, ...supplementalInsetFeatures].map(
        ({ id, paths, polygons, anchor, bounds: featureBounds }) => [
          id,
          { paths, polygons, anchor, bounds: featureBounds },
        ],
      ),
    ),
  };
}
