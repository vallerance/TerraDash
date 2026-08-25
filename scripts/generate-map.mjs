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
  buildManifestArtifact,
  buildMapArtifact,
} from './generator/artifacts.mjs';

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
const overrides = JSON.parse(fs.readFileSync('data/geometry-overrides.json'));

function checkedSourceBytes(definition) {
  const bytes = fs.readFileSync(definition.path);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== definition.sha256)
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
const canonicalSupplementalFeatures = SUPPLEMENTAL_SOURCES.flatMap(
  (definition) =>
    checkedSupplementalSources.get(definition.id).features.map((feature) => {
      const sourceId =
        feature.properties.NE_ID ??
        feature.properties.ne_id ??
        feature.properties.adm1_code ??
        feature.properties.shapeID;
      return {
        id: `${definition.prefix ?? 'ne'}:${definition.id}:${sourceId}`,
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
    const sourceId = p.NE_ID ?? p.ne_id ?? p.adm1_code ?? p.shapeID;
    const id = `${definition.prefix ?? 'ne'}:${definition.id}:${sourceId}`;
    const applied = appliedReplacements.byCanonical.get(id);
    const replacement = applied?.replacement;
    const geometry = applied?.geometry ?? feature.geometry;
    const { paths } = buildGeometryFeature(geometry, id);
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
          : [bounds(points)[0], bounds(points)[1]],
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
    'data/generated/inset.json',
  ],
  { stdio: 'ignore' },
);
console.log(
  `Generated ${locations.length} locations and ${features.length} source features.`,
);
