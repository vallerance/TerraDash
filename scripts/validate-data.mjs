import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  indexNamespace,
  validateReplacementContract,
  sourcePropertyKeys,
} from './map-contract.mjs';

const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const sameSet = (left, right) =>
  JSON.stringify([...new Set(left)].sort()) ===
  JSON.stringify([...new Set(right)].sort());

const authored = read('data/locations.json');
const generated = read('data/generated/locations.json');
const quizzes = read('data/quizzes.json');
const invariants = read('data/reviewed-invariants.json');
const map = read('data/generated/map.json');
const inset = read('data/generated/inset.json');
const geometrySources = read('data/geometry-sources.json');
const source = read('data/source/ne_50m_admin_0_countries.geojson');
const insetSource = read('data/source/ne_10m_admin_0_countries.geojson');
const overrides = read('data/geometry-overrides.json');

const authoredIds = authored.map(({ id }) => id);
const generatedIds = generated.map(({ id }) => id);
if (!sameSet(authoredIds, generatedIds))
  throw new Error(
    'Generated locations do not exactly match the authored registry',
  );
if (new Set(authoredIds).size !== authoredIds.length)
  throw new Error('Authored location IDs must be globally unique');
if (!sameSet(authoredIds, invariants.locationIds))
  throw new Error('Authored location set changed from the reviewed baseline');

const locationById = new Map(
  generated.map((location) => [location.id, location]),
);
for (const location of authored) {
  if (!location.id || !location.name || !location.resolution)
    throw new Error(
      `Invalid authored location record ${location.id ?? '<missing>'}`,
    );
  const { resolution } = location;
  if (!['source-keys', 'exact-refs'].includes(resolution.kind))
    throw new Error(`Unknown resolution kind for ${location.id}`);
  if (resolution.kind === 'source-keys') {
    if (!resolution.keys?.length)
      throw new Error(`Missing source keys for ${location.id}`);
    for (const entry of resolution.keys)
      if (!entry.source || !entry.key)
        throw new Error(
          `Source keys require source and key for ${location.id}`,
        );
  } else if (!resolution.refs?.length)
    throw new Error(`Missing exact refs for ${location.id}`);
  const result = locationById.get(location.id);
  if (!result?.geometryRefs?.length)
    throw new Error(`Generated location lacks geometry for ${location.id}`);
}

const quizIds = quizzes.map(({ id }) => id);
if (new Set(quizIds).size !== quizIds.length)
  throw new Error('Quiz IDs must be unique');
for (const quiz of quizzes) {
  if (!Array.isArray(quiz.locationIds))
    throw new Error(`Quiz ${quiz.id} must declare locationIds`);
  if (
    new Set(quiz.locationIds).size !== quiz.locationIds.length ||
    quiz.locationIds.some((id) => !locationById.has(id))
  )
    throw new Error(`Quiz ${quiz.id} has duplicate or unresolved locationIds`);
  for (const id of quiz.map?.baseLayerLocationIds ?? [])
    if (!quiz.locationIds.includes(id))
      throw new Error(
        `Quiz ${quiz.id} base layer location is not a member: ${id}`,
      );
  for (const id of quiz.map?.contextFeatureExclusions ?? [])
    if (!map.features[id])
      throw new Error(`Quiz ${quiz.id} excludes unknown context feature ${id}`);
}
for (const quiz of quizzes)
  if (!sameSet(quiz.locationIds, invariants.quizMemberships[quiz.id] ?? []))
    throw new Error(`Reviewed membership changed for quiz ${quiz.id}`);

if (map.sourceFeatureIds.length !== source.features.length)
  throw new Error('Base feature index does not cover the canonical source');
if (new Set(map.sourceFeatureIds).size !== map.sourceFeatureIds.length)
  throw new Error('Base feature IDs are not unique');
if (map.sourceFeatureIds.some((id) => map.supplementalFeatureIds.includes(id)))
  throw new Error('Base feature index contains supplemental IDs');
if (map.supplementalFeatureIds.some((id) => !map.features[id]))
  throw new Error('Supplemental feature index contains unknown IDs');
if (inset.sourceFeatureIds.some((id) => !inset.features[id]))
  throw new Error('Inset feature index contains unknown IDs');

const mapLocationIds = Object.keys(map.locationFeatureIds ?? {});
const insetLocationIds = Object.keys(inset.locationFeatureIds ?? {});
if (
  !sameSet(mapLocationIds, generatedIds) ||
  !sameSet(insetLocationIds, generatedIds)
)
  throw new Error(
    'Generated map indexes do not exactly cover the location registry',
  );
for (const location of generated) {
  const mainRefs = map.locationFeatureIds[location.id];
  const insetRefs = inset.locationFeatureIds[location.id];
  if (!mainRefs?.length || !insetRefs?.length)
    throw new Error(`Missing geometry index entry for ${location.id}`);
  if (
    mainRefs.some((id) => !map.features[id]) ||
    insetRefs.some((id) => !inset.features[id])
  )
    throw new Error(`Unresolvable geometry index entry for ${location.id}`);
  if (
    location.resolution.kind === 'exact-refs' &&
    JSON.stringify(insetRefs) !== JSON.stringify(location.geometryRefs)
  )
    throw new Error(`Exact geometry refs changed for ${location.id}`);
}

const sourceFeatureCache = new Map();
for (const [sourceId, definition] of Object.entries(
  geometrySources.sources ?? {},
)) {
  const features = read(definition.path).features;
  sourceFeatureCache.set(sourceId, features);
}
const replacements = geometrySources.replacements ?? [];
const generatedResolvedLocations = authored.map((location) => ({
  location,
  matches: (generated.find(({ id }) => id === location.id)?.geometryRefs ?? [])
    .map((id) => (map.features[id] ? { ...map.features[id], id } : undefined))
    .filter(Boolean),
}));
validateReplacementContract({
  locations: authored,
  resolvedLocations: generatedResolvedLocations,
  replacements,
  sources: new Set(Object.keys(geometrySources.sources ?? {})),
  appliedCanonicalFeatureIds: new Set(Object.keys(map.features)),
  alternateNamespaces: new Map(
    [...sourceFeatureCache].map(([sourceId, features]) => [
      sourceId,
      indexNamespace(sourceId, features, (feature) =>
        sourcePropertyKeys(feature.properties),
      ),
    ]),
  ),
});
const replacementKeys = new Set();
for (const replacement of replacements) {
  if (
    !replacement.locationId ||
    !replacement.canonicalFeatureId ||
    !replacement.source ||
    !replacement.featureKey
  )
    throw new Error('Every geometry replacement requires complete provenance');
  const pair = `${replacement.locationId}/${replacement.canonicalFeatureId}`;
  if (replacementKeys.has(pair))
    throw new Error(`Duplicate geometry replacement ${pair}`);
  replacementKeys.add(pair);
  if (!map.features[replacement.canonicalFeatureId])
    throw new Error(
      `Replacement canonical feature is unknown: ${replacement.canonicalFeatureId}`,
    );
  const features = sourceFeatureCache.get(replacement.source);
  if (!features)
    throw new Error(`Replacement source is undefined: ${replacement.source}`);
  const matches = features.filter((feature) =>
    [
      feature.properties.shapeISO,
      feature.properties.shapeID,
      feature.properties.shapeName,
    ]
      .filter(Boolean)
      .includes(replacement.featureKey),
  );
  if (matches.length !== 1)
    throw new Error(
      `Replacement feature key is not unique: ${replacement.source}/${replacement.featureKey}`,
    );
  const generated = map.features[replacement.canonicalFeatureId];
  if (
    !generated.replacement ||
    generated.replacement.canonicalFeatureId !==
      replacement.canonicalFeatureId ||
    generated.replacement.source !== replacement.source ||
    generated.replacement.featureKey !== replacement.featureKey
  )
    throw new Error(
      `Generated replacement provenance is incomplete: ${replacement.canonicalFeatureId}`,
    );
}

for (const [locationId, refs] of Object.entries(overrides)) {
  if (
    !locationById.has(locationId) ||
    refs.length < 2 ||
    refs.some((id) => !map.features[id])
  )
    throw new Error(`Invalid reviewed geometry override for ${locationId}`);
}
if (
  !sameSet(
    invariants.relationships.nonUnCandidateIds,
    authored.filter(({ id }) => id.startsWith('non-un:')).map(({ id }) => id),
  )
)
  throw new Error('Reviewed Non-UN candidate set changed');
const nonUn = quizzes.find(({ id }) => id === 'non-un');
if (!sameSet(nonUn?.locationIds ?? [], invariants.relationships.nonUnMembers))
  throw new Error('Reviewed Non-UN membership set changed');
for (const excluded of invariants.relationships.nonUnExcludedOverlap)
  if (nonUn.locationIds.includes(excluded))
    throw new Error(`Overlap exclusion removed: ${excluded}`);
for (const aggregate of invariants.relationships.nonUnAggregate)
  if (!nonUn.locationIds.includes(aggregate))
    throw new Error(`Aggregate membership removed: ${aggregate}`);

execFileSync(process.execPath, ['scripts/validate-fixtures.mjs'], {
  stdio: 'inherit',
});

console.log(
  `Data validation passed: ${generated.length} canonical locations, ${source.features.length} base features, ${inset.sourceFeatureIds.length} inset source features.`,
);
