import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  indexNamespace,
  applyGeometryReplacements,
  resolveLocationFeatures,
  sourcePropertyKeys,
  validateSourceUsage,
  validateReplacementContract,
} from './map-contract.mjs';
import {
  EXPECTED_SOURCE_SHA256,
  HEIGHT,
  INSET_SOURCE_PATH,
  INSET_SOURCE_SHA256,
  INSET_SOURCE_URL,
  SOURCE_PATH,
  SOURCE_URL,
  WIDTH,
} from './generator/constants.mjs';
import {
  bounds,
  buildGeometryFeature,
  featureKey,
  pathPoints,
  project,
} from './generator/geometry.mjs';
import {
  buildInsetArtifact,
  buildContextArtifact,
  buildManifestArtifact,
  buildMapArtifact,
} from './generator/artifacts.mjs';

execFileSync(process.execPath, [
  'scripts/derive-world-regions.mjs',
  '--output',
  'data/source/world-regions.geojson',
]);

const sourcePath = SOURCE_PATH;
const insetSourcePath = INSET_SOURCE_PATH;
const geometrySources = JSON.parse(
  fs.readFileSync('data/geometry-sources.json', 'utf8'),
);
const SUPPLEMENTAL_SOURCES = Object.entries(geometrySources.sources).map(
  ([id, definition]) => ({ id, ...definition }),
);
const sourceBytes = fs.readFileSync(sourcePath);
const sourceSha256 = crypto
  .createHash('sha256')
  .update(sourceBytes)
  .digest('hex');
if (sourceSha256 !== EXPECTED_SOURCE_SHA256)
  throw new Error(
    `Natural Earth source checksum mismatch: expected ${EXPECTED_SOURCE_SHA256}, got ${sourceSha256}`,
  );
const source = JSON.parse(sourceBytes);
const insetSourceBytes = fs.readFileSync(insetSourcePath);
const insetSourceSha256 = crypto
  .createHash('sha256')
  .update(insetSourceBytes)
  .digest('hex');
if (insetSourceSha256 !== INSET_SOURCE_SHA256)
  throw new Error(
    `Natural Earth inset source checksum mismatch: expected ${INSET_SOURCE_SHA256}, got ${insetSourceSha256}`,
  );
const insetSource = JSON.parse(insetSourceBytes);
const authoredLocations = JSON.parse(fs.readFileSync('data/locations.json'));
const authoredQuizzes = JSON.parse(fs.readFileSync('data/quizzes.json'));
const overrides = JSON.parse(fs.readFileSync('data/geometry-overrides.json'));

function canonicalSupplementalId(definition, feature) {
  const p = feature.properties;
  const sourceId =
    p.world_id ?? p.id ?? p.NE_ID ?? p.ne_id ?? p.adm1_code ?? p.shapeID;
  return `${definition.prefix ?? 'ne'}:${definition.id}:${sourceId}`;
}

function checkedSourceBytes(definition) {
  const bytes = fs.readFileSync(definition.path);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  if (
    definition.sha256 !== 'derived-from-pinned-inputs' &&
    sha256 !== definition.sha256
  )
    throw new Error(
      `${definition.id} source checksum mismatch: expected ${definition.sha256}, got ${sha256}`,
    );
  return JSON.parse(bytes);
}

const features = source.features.map((feature) => {
  const { paths } = buildGeometryFeature(
    feature.geometry,
    `ne:${feature.properties.NE_ID}`,
  );
  const points = pathPoints(paths);
  const id = `ne:${feature.properties.NE_ID}`;
  const anchor =
    feature.properties.LABEL_X != null && feature.properties.LABEL_Y != null
      ? project([feature.properties.LABEL_X, feature.properties.LABEL_Y])
      : [bounds(points)[0], bounds(points)[1]];
  return {
    id,
    keys: featureKey(feature),
    paths,
    anchor,
    bounds: bounds(points),
    parts: paths.map((path, index) => {
      const partPoints = pathPoints([path]);
      return {
        id: `${id}:part:${index}`,
        paths: [path],
        anchor: [
          +(
            partPoints.reduce((sum, point) => sum + point[0], 0) /
            partPoints.length
          ).toFixed(2),
          +(
            partPoints.reduce((sum, point) => sum + point[1], 0) /
            partPoints.length
          ).toFixed(2),
        ],
        bounds: bounds(partPoints),
      };
    }),
  };
});
const checkedSupplementalSources = new Map(
  SUPPLEMENTAL_SOURCES.map((definition) => [
    definition.id,
    checkedSourceBytes(definition),
  ]),
);
const replacements = geometrySources.replacements ?? [];
const alternateNamespaces = new Map(
  SUPPLEMENTAL_SOURCES.map(({ id }) => [
    id,
    indexNamespace(id, checkedSupplementalSources.get(id).features, (feature) =>
      sourcePropertyKeys(feature.properties),
    ),
  ]),
);
const regionalToleranceByFeatureId = new Map();
for (const quiz of authoredQuizzes) {
  const tolerance = quiz.map?.regionalDetail?.mainTolerance;
  if (tolerance == null) continue;
  if (!Number.isFinite(tolerance) || tolerance <= 0)
    throw new Error(`Invalid regional detail tolerance for ${quiz.id}`);
  for (const locationId of new Set([
    ...quiz.locationIds,
    ...(quiz.map?.baseLayerLocationIds ?? []),
  ])) {
    const location = authoredLocations.find(({ id }) => id === locationId);
    if (!location)
      throw new Error(
        `Regional detail references unknown location ${locationId}`,
      );
    if (location.resolution.kind !== 'source-keys')
      throw new Error(
        `Regional detail requires source-key resolution for ${locationId}`,
      );
    for (const { source, key } of location.resolution.keys) {
      const definition = SUPPLEMENTAL_SOURCES.find(({ id }) => id === source);
      if (!definition) continue;
      const matches = alternateNamespaces.get(source)?.index.get(key) ?? [];
      for (const feature of matches) {
        const id = canonicalSupplementalId(definition, feature);
        const prior = regionalToleranceByFeatureId.get(id);
        if (prior != null && prior !== tolerance)
          throw new Error(`Conflicting regional detail tolerances for ${id}`);
        regionalToleranceByFeatureId.set(id, tolerance);
      }
    }
  }
}
const canonicalSupplementalFeatures = SUPPLEMENTAL_SOURCES.flatMap(
  (definition) =>
    checkedSupplementalSources.get(definition.id).features.map((feature) => {
      return {
        id: canonicalSupplementalId(definition, feature),
        geometry: feature.geometry,
      };
    }),
);
const appliedReplacements = applyGeometryReplacements({
  features: canonicalSupplementalFeatures,
  replacements,
  alternateNamespaces,
});
validateSourceUsage({
  sources: new Set(SUPPLEMENTAL_SOURCES.map(({ id }) => id)),
  emittedSourceIds: new Set(
    SUPPLEMENTAL_SOURCES.filter(({ emit = true }) => emit).map(({ id }) => id),
  ),
  appliedSourceIds: appliedReplacements.appliedSourceIds,
});
const supplementalFeatures = SUPPLEMENTAL_SOURCES.filter(
  ({ emit = true }) => emit,
).flatMap((definition) =>
  checkedSupplementalSources.get(definition.id).features.map((feature) => {
    const p = feature.properties;
    const id = canonicalSupplementalId(definition, feature);
    const applied = appliedReplacements.byCanonical.get(id);
    const replacement = applied?.replacement;
    const geometry = applied?.geometry ?? feature.geometry;
    const defaultPaths = buildGeometryFeature(geometry, id).paths;
    const defaultPoints = pathPoints(defaultPaths);
    const { paths } = buildGeometryFeature(
      geometry,
      id,
      'main',
      regionalToleranceByFeatureId.get(id),
    );
    const points = pathPoints(paths);
    return {
      id,
      source: definition.id,
      geometry,
      geometrySource: replacement
        ? `${SUPPLEMENTAL_SOURCES.find(({ id: source }) => source === replacement.source).prefix ?? 'ne'}:${replacement.source}`
        : definition.id,
      replacement: applied?.replacement,
      sourceCodes: [
        p.iso_3166_2,
        p.ISO_A2,
        p.ISO_A2_EH,
        p.iso_a2,
        p.SU_A3,
        p.ADM0_A3,
        p.adm0_a3,
      ].filter(Boolean),
      keys: [
        p.id,
        p.iso_3166_2,
        p.ISO_A2,
        p.ISO_A2_EH,
        p.SU_A3,
        p.ADM0_A3,
        p.adm0_a3,
        p.name,
        p.name_en,
        p.NAME,
        p.NAME_LONG,
        p.SUBUNIT,
        p.shapeID,
        p.shapeName,
        p.shapeISO,
        p.shapeGroup,
        p.shapeType,
        p.BRK_A3,
        p.BRK_NAME,
      ].filter(Boolean),
      labels: [
        p.iso_3166_2,
        p.name,
        p.name_en,
        p.name_alt,
        p.NAME,
        p.NAME_LONG,
        p.SUBUNIT,
        p.shapeName,
        p.BRK_NAME,
      ]
        .filter(Boolean)
        .flatMap((value) => String(value).split(/[|;]/)),
      alternateLabels: String(p.name_alt ?? '')
        .split(/[|;]/)
        .filter(Boolean),
      paths,
      anchor:
        p.LABEL_X != null && p.LABEL_Y != null
          ? project([p.LABEL_X, p.LABEL_Y])
          : [bounds(defaultPoints)[0], bounds(defaultPoints)[1]],
      bounds: bounds(points),
    };
  }),
);
for (const replacement of replacements)
  if (
    !supplementalFeatures.some(
      ({ id }) => id === replacement.canonicalFeatureId,
    )
  )
    throw new Error(
      `Geometry replacement canonical feature is unused: ${replacement.canonicalFeatureId}`,
    );
const featuresByKey = new Map();
for (const feature of features)
  for (const key of new Set(feature.keys))
    featuresByKey.set(key, [...(featuresByKey.get(key) ?? []), feature]);
const featuresById = new Map([
  ...features.map((feature) => [feature.id, feature]),
  ...supplementalFeatures.map((feature) => [feature.id, feature]),
]);
const namespaces = new Map([
  ['natural-earth-admin0', indexNamespace('natural-earth-admin0', features)],
  ...SUPPLEMENTAL_SOURCES.map(({ id }) => [
    id,
    indexNamespace(
      id,
      supplementalFeatures.filter(({ source }) => source === id),
    ),
  ]),
]);
const resolvedLocations = resolveLocationFeatures(authoredLocations, {
  namespaces,
  featuresById,
});
validateReplacementContract({
  locations: authoredLocations,
  resolvedLocations,
  replacements,
  sources: checkedSupplementalSources,
  appliedCanonicalFeatureIds: new Set(supplementalFeatures.map(({ id }) => id)),
  alternateNamespaces: new Map(
    SUPPLEMENTAL_SOURCES.map(({ id }) => [
      id,
      indexNamespace(
        id,
        checkedSupplementalSources.get(id).features,
        (feature) => sourcePropertyKeys(feature.properties),
      ),
    ]),
  ),
});
const locations = resolvedLocations.map(({ location, matches }) => {
  if (!matches.length)
    throw new Error(
      `No canonical feature for ${location.id} (${location.name})`,
    );
  const geometryRefs =
    overrides[location.id] ?? matches.map((feature) => feature.id);
  const points = matches.flatMap((feature) => pathPoints(feature.paths));
  const anchor = matches
    .map((feature) => feature.anchor)
    .reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0])
    .map((value) => +(value / matches.length).toFixed(2));
  return {
    id: location.id,
    name: location.name,
    resolution: location.resolution,
    geometryRefs,
    anchor,
    bounds: bounds(points),
    evidence: location.evidence,
  };
});

const contextSourceFeaturesByKey = new Map();
for (const feature of insetSource.features) {
  for (const key of new Set(featureKey(feature))) {
    const matches = contextSourceFeaturesByKey.get(key) ?? [];
    matches.push(feature);
    contextSourceFeaturesByKey.set(key, matches);
  }
}

function parseViewBox(value, quizId) {
  const parts = String(value ?? '')
    .trim()
    .split(/\s+/)
    .map(Number);
  if (
    parts.length !== 4 ||
    !parts.every(Number.isFinite) ||
    parts[2] <= 0 ||
    parts[3] <= 0
  )
    throw new Error(`Regional context requires a valid viewBox for ${quizId}`);
  return parts;
}

function boundsIntersectViewport(featureBounds, viewport, wrapWidth) {
  const [minX, minY, maxX, maxY] = featureBounds;
  const [viewMinX, viewMaxX, viewMinY, viewMaxY] = viewport;
  if (maxY < viewMinY || minY > viewMaxY) return false;
  for (const offset of [-wrapWidth, 0, wrapWidth]) {
    if (maxX + offset >= viewMinX && minX + offset <= viewMaxX) return true;
  }
  return false;
}

function retainedContextFeatureIds(quiz) {
  const mapConfig = quiz.map;
  const [viewMinX, viewMinY, viewWidth, viewHeight] = parseViewBox(
    mapConfig?.viewBox,
    quiz.id,
  );
  const viewMaxX = viewMinX + viewWidth;
  const viewMaxY = viewMinY + viewHeight;
  const yScale =
    1 / Math.cos(((mapConfig?.standardParallel ?? 0) * Math.PI) / 180);
  const projectionCenterY = (viewMinY + viewMaxY) / 2;
  const projectedY = (value) =>
    projectionCenterY + (value - projectionCenterY) * yScale;
  const viewport = [viewMinX, viewMaxX, viewMinY, viewMaxY];
  const excluded = new Set(mapConfig?.contextFeatureExclusions ?? []);
  return features
    .filter(({ id, bounds: featureBounds }) => {
      if (excluded.has(id)) return false;
      const projectedYBounds = [
        projectedY(featureBounds[1]),
        projectedY(featureBounds[3]),
      ];
      const projectedBounds = [
        featureBounds[0],
        Math.min(featureBounds[1], ...projectedYBounds),
        featureBounds[2],
        Math.max(featureBounds[3], ...projectedYBounds),
      ];
      return boundsIntersectViewport(
        projectedBounds,
        viewport,
        mapConfig?.wrapWidth ?? WIDTH,
      );
    })
    .map(({ id }) => id);
}

const contextVariantInputs = new Map();
for (const quiz of authoredQuizzes) {
  const context = quiz.map?.regionalDetail?.context;
  if (context == null) continue;
  if (context.source !== 'admin0-10m')
    throw new Error(`Unsupported regional context source for ${quiz.id}`);
  if (!Number.isFinite(context.tolerance) || context.tolerance <= 0)
    throw new Error(`Invalid regional context tolerance for ${quiz.id}`);
  const variantKey = `${context.source}:${context.tolerance}`;
  const variant = contextVariantInputs.get(variantKey) ?? {
    source: context.source,
    tolerance: context.tolerance,
    features: new Map(),
  };
  for (const baseId of retainedContextFeatureIds(quiz)) {
    const base = featuresById.get(baseId);
    if (!base) throw new Error(`Missing retained context feature ${baseId}`);
    const mappingCandidates = base.keys.flatMap((key) => {
      const baseMatches = featuresByKey.get(key) ?? [];
      const contextMatches = contextSourceFeaturesByKey.get(key) ?? [];
      return baseMatches.length === 1 && contextMatches.length === 1
        ? contextMatches
        : [];
    });
    const contextMatches = [
      ...new Map(
        mappingCandidates.map((feature) => [
          `ne:${feature.properties.NE_ID}`,
          feature,
        ]),
      ).values(),
    ];
    if (contextMatches.length !== 1)
      throw new Error(
        `Context source mapping must resolve uniquely: ${baseId}`,
      );
    const contextFeature = contextMatches[0];
    if (`ne:${contextFeature.properties.NE_ID}` !== base.id)
      throw new Error(`Context source mapping changed for ${base.id}`);
    const { paths } = buildGeometryFeature(
      contextFeature.geometry,
      base.id,
      'main',
      context.tolerance,
    );
    const points = pathPoints(paths);
    variant.features.set(base.id, {
      paths,
      anchor: base.anchor,
      bounds: bounds(points),
    });
  }
  contextVariantInputs.set(variantKey, variant);
}
const contextVariants = [...contextVariantInputs.values()].map((variant) => ({
  source: variant.source,
  tolerance: variant.tolerance,
  featureIds: [...variant.features.keys()],
  features: Object.fromEntries(variant.features),
}));

const referencedSupplementalIds = new Set([
  ...locations.flatMap(({ geometryRefs }) => geometryRefs),
]);
const playableSupplementalFeatures = supplementalFeatures.filter(({ id }) =>
  referencedSupplementalIds.has(id),
);
const playableLocations = locations;
const playableLocationIds = playableLocations.map(({ id }) => id);
const mainFeatureIds = new Set(
  [...features, ...playableSupplementalFeatures].flatMap(
    ({ id, parts = [] }) => [id, ...parts.map(({ id: partId }) => partId)],
  ),
);
if (new Set(playableLocationIds).size !== playableLocationIds.length)
  throw new Error('Playable location IDs must be globally unique');
const playableLocationFeatureIds = Object.fromEntries(
  playableLocations.map((location) => [location.id, location.geometryRefs]),
);
if (
  Object.keys(playableLocationFeatureIds).length !== playableLocations.length ||
  playableLocations.some((location) =>
    location.geometryRefs.some((ref) => !mainFeatureIds.has(ref)),
  )
)
  throw new Error(
    'Every playable location must resolve to generated main geometry',
  );
const map = buildMapArtifact({
  width: WIDTH,
  height: HEIGHT,
  sourceUrl: SOURCE_URL,
  sourceSha256: EXPECTED_SOURCE_SHA256,
  features,
  playableSupplementalFeatures,
  playableLocationFeatureIds,
});
fs.mkdirSync('data/generated', { recursive: true });
fs.writeFileSync(
  'data/generated/map.json',
  JSON.stringify(map, null, 2) + '\n',
);
fs.writeFileSync(
  'data/generated/locations.json',
  JSON.stringify(locations, null, 2) + '\n',
);
fs.writeFileSync(
  'data/generated/context.json',
  JSON.stringify(buildContextArtifact({ variants: contextVariants }), null, 2) +
    '\n',
);
fs.writeFileSync(
  'data/generated/manifest.json',
  JSON.stringify(
    buildManifestArtifact({
      sourceSha256: EXPECTED_SOURCE_SHA256,
      sourceUrl: SOURCE_URL,
      supplementalSources: SUPPLEMENTAL_SOURCES,
      supplementalFeatures,
      map,
      insetSourceSha256: INSET_SOURCE_SHA256,
      insetSourceUrl: INSET_SOURCE_URL,
      insetSource,
      playableLocationFeatureIds,
      contextVariants,
    }),
    null,
    2,
  ) + '\n',
);
const insetFeatures = insetSource.features.map((feature) => {
  const id = `ne:${feature.properties.NE_ID}`;
  const { paths, polygons } = buildGeometryFeature(
    feature.geometry,
    id,
    'inset',
  );
  const points = pathPoints(paths);
  return {
    id,
    keys: featureKey(feature),
    paths,
    polygons,
    anchor:
      feature.properties.LABEL_X != null && feature.properties.LABEL_Y != null
        ? project([feature.properties.LABEL_X, feature.properties.LABEL_Y])
        : [bounds(points)[0], bounds(points)[1]],
    bounds: bounds(points),
  };
});
const configuredInsetFeatureIds = new Set(
  locations.flatMap(({ geometryRefs }) => geometryRefs),
);
const nonUnInsetFeatureIds = configuredInsetFeatureIds;
const supplementalInsetFeatures = playableSupplementalFeatures
  .filter(({ id }) => nonUnInsetFeatureIds.has(id))
  .map((feature) => {
    const { paths, polygons } = buildGeometryFeature(
      feature.geometry,
      feature.id,
      'inset',
    );
    const points = pathPoints(paths);
    return {
      id: feature.id,
      source: feature.source,
      keys: feature.keys,
      paths,
      polygons,
      anchor: feature.anchor,
      bounds: bounds(points),
    };
  });
const insetFeaturesByKey = new Map();
for (const feature of insetFeatures)
  for (const key of new Set(feature.keys))
    insetFeaturesByKey.set(key, [
      ...(insetFeaturesByKey.get(key) ?? []),
      feature,
    ]);
const insetFeaturesById = new Map(
  [...insetFeatures, ...supplementalInsetFeatures].map((feature) => [
    feature.id,
    feature,
  ]),
);
const insetLocationFeatures = Object.fromEntries(
  locations.map((location) => {
    const insetNamespaces = new Map([
      [
        'natural-earth-admin0',
        indexNamespace('natural-earth-admin0', insetFeatures),
      ],
      ...SUPPLEMENTAL_SOURCES.map(({ id }) => [
        id,
        indexNamespace(
          id,
          supplementalInsetFeatures.filter(({ source }) => source === id),
        ),
      ]),
    ]);
    const refs =
      location.resolution?.kind === 'source-keys'
        ? location.resolution.keys.flatMap(({ source, key }) =>
            (insetNamespaces.get(source)?.index.get(key) ?? []).map(
              ({ id }) => id,
            ),
          )
        : location.geometryRefs;
    if (!refs.length || refs.some((id) => !insetFeaturesById.has(id)))
      throw new Error(
        `No exact inset feature for every geometry ref in ${location.id}`,
      );
    return [location.id, refs];
  }),
);
if (
  Object.keys(insetLocationFeatures).length !== locations.length ||
  new Set(Object.keys(insetLocationFeatures)).size !== locations.length
)
  throw new Error(
    'Inset location index must have exact playable-location parity',
  );
const inset = buildInsetArtifact({
  width: WIDTH,
  height: HEIGHT,
  sourceUrl: INSET_SOURCE_URL,
  sourceSha256: INSET_SOURCE_SHA256,
  supplementalSources: SUPPLEMENTAL_SOURCES,
  insetFeatures,
  insetLocationFeatures,
  supplementalInsetFeatures,
  locationsCount: locations.length,
});
fs.writeFileSync(
  'data/generated/inset.json',
  JSON.stringify(inset, null, 2) + '\n',
);
const prettier = process.platform === 'win32' ? 'prettier.cmd' : 'prettier';
execFileSync(
  prettier,
  [
    '--write',
    'data/generated/manifest.json',
    'data/generated/map.json',
    'data/generated/locations.json',
    'data/generated/context.json',
    'data/generated/inset.json',
  ],
  { stdio: 'ignore' },
);
console.log(
  `Generated ${locations.length} locations and ${features.length} source features.`,
);
