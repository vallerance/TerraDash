import fs from 'node:fs';
const catalog = JSON.parse(fs.readFileSync('data/generated/catalog.json'));
const quiz = JSON.parse(fs.readFileSync('data/generated/quiz.json'));
const map = JSON.parse(fs.readFileSync('data/generated/map.json'));
const candidates = JSON.parse(
  fs.readFileSync('data/generated/non-un-candidates.json'),
);
const inset = JSON.parse(fs.readFileSync('data/generated/inset.json'));
const overrides = JSON.parse(fs.readFileSync('data/geometry-overrides.json'));
const removedCandidateIds = new Set([
  'non-un:andalusia',
  'non-un:aragon',
  'non-un:asturias',
  'non-un:balearic-islands',
  'non-un:basque-country',
  'non-un:canary-islands',
  'non-un:cantabria',
  'non-un:castile-and-leon',
  'non-un:castilla-la-mancha',
  'non-un:catalonia',
  'non-un:extremadura',
  'non-un:galicia',
  'non-un:la-rioja',
  'non-un:madrid',
  'non-un:murcia',
  'non-un:navarre',
  'non-un:valencia',
]);
const newCaledonia = candidates.find(({ id }) => id === 'non-un:new-caledonia');
const forbiddenBritishColumbiaRef = 'ne:admin1:1159307717';
if (
  !newCaledonia ||
  newCaledonia.geometryRefs.length !== 2 ||
  !newCaledonia.geometryRefs.includes('ne:map-unit:1159320641') ||
  !newCaledonia.geometryRefs.includes('ne:map-subunit:1159320641') ||
  newCaledonia.geometryRefs.includes(forbiddenBritishColumbiaRef)
)
  throw new Error(
    'New Caledonia must use only its exact map-unit and map-subunit geometry; British Columbia must not be selected.',
  );
const nakhchivan = candidates.find(({ id }) => id === 'non-un:nakhchivan');
const kosovo = candidates.find(({ id }) => id === 'non-un:kosovo');
if (
  !kosovo ||
  JSON.stringify(kosovo.geometryRefs) !==
    JSON.stringify(['ne:map-unit:1159321007', 'ne:map-subunit:1159321007'])
)
  throw new Error(
    'Kosovo must use the exact Natural Earth map-unit/subunit pair, not unrelated admin1 same-label features.',
  );
const expectedNakhchivanRefs = ['gb:aze-adm1:63332228B45413776644545'];
if (
  !nakhchivan ||
  JSON.stringify(nakhchivan.geometryRefs) !==
    JSON.stringify(expectedNakhchivanRefs) ||
  nakhchivan.bounds[2] - nakhchivan.bounds[0] <= 4 ||
  nakhchivan.bounds[3] - nakhchivan.bounds[1] <= 3
)
  throw new Error(
    'Nakhchivan must use the pinned geoBoundaries autonomous-republic feature, not the Natural Earth Nakhchivan city feature.',
  );
const source = JSON.parse(
  fs.readFileSync('data/source/ne_50m_admin_0_countries.geojson'),
);
const insetSource = JSON.parse(
  fs.readFileSync('data/source/ne_10m_admin_0_countries.geojson'),
);
const ids = new Set(catalog.map((item) => item.id));
const playable = [...catalog, ...candidates];
const playableIds = new Set(playable.map((item) => item.id));
if (catalog.length !== 195 || ids.size !== 195)
  throw new Error('Expected 195 unique catalog entries');
if (new Set(catalog.map((item) => item.iso3)).size !== 195)
  throw new Error('Duplicate ISO3');
if (
  quiz.locationIds.length !== 195 ||
  quiz.locationIds.some((id) => !ids.has(id))
)
  throw new Error('Quiz does not resolve to catalog');
if (map.sourceFeatureIds.length !== source.features.length)
  throw new Error('Base layer does not include every source feature');
if (map.sourceFeatureIds.some((id) => map.supplementalFeatureIds.includes(id)))
  throw new Error('Base source index must exclude supplemental exact features');
if (new Set(map.sourceFeatureIds).size !== source.features.length)
  throw new Error('Base feature IDs are not stable and unique');
if (
  map.supplementalFeatureIds.length !== new Set(map.supplementalFeatureIds).size
)
  throw new Error('Supplemental feature IDs are not stable and unique');
if (
  map.supplementalFeatureIds.some((id) => !map.features[id]) ||
  inset?.sourceFeatureIds?.some((id) => !inset.features[id])
)
  throw new Error('Generated feature indexes contain unknown feature IDs');
for (const [featureId, feature] of Object.entries(map.features)) {
  if (!feature.paths.length || !feature.bounds || feature.bounds.length !== 4)
    throw new Error(`Invalid base feature ${featureId}`);
  for (const path of feature.paths)
    if (!/^M[-0-9.,]+(?:L[-0-9.,]+)*Z$/.test(path))
      throw new Error(`Invalid path for ${featureId}`);
}
for (const item of catalog) {
  if (
    !item.geometryRefs.length ||
    item.geometryRefs.some((id) => !map.features[id])
  )
    throw new Error(`Missing geometry reference for ${item.id}`);
  if (!item.bounds || item.bounds.some((value) => !Number.isFinite(value)))
    throw new Error(`Missing projected bounds for ${item.id}`);
}
if (candidates.length !== 84)
  throw new Error('Expected exactly 84 non-UN candidates');
if (playable.length !== 279 || playableIds.size !== 279)
  throw new Error('Expected exactly 279 unique playable locations');
if ([...removedCandidateIds].some((id) => playableIds.has(id)))
  throw new Error('Removed Spanish candidates remain playable');
for (const candidate of candidates) {
  if (
    !candidate.geometryRefs.length ||
    candidate.geometryRefs.some(
      (id) =>
        !map.features[id] ||
        !map.supplementalFeatureIds.includes(id) ||
        !/^(ne:admin1|ne:map-unit|ne:map-subunit):/.test(id),
    )
  )
    throw new Error(
      `Invalid exact geometry for non-UN candidate ${candidate.id}`,
    );
}
if (
  Object.keys(map.locationFeatureIds ?? {}).length !== 279 ||
  Object.keys(inset.locationFeatureIds ?? {}).length !== 279
)
  throw new Error(
    'Main and inset indexes must cover exactly 279 playable locations',
  );
if (
  new Set(Object.keys(map.locationFeatureIds ?? {})).size !== 279 ||
  new Set(Object.keys(inset.locationFeatureIds ?? {})).size !== 279 ||
  JSON.stringify(Object.keys(map.locationFeatureIds).sort()) !==
    JSON.stringify(Object.keys(inset.locationFeatureIds).sort())
)
  throw new Error('Main and inset indexes must have identical playable IDs');
for (const item of playable) {
  const mainRefs = map.locationFeatureIds[item.id];
  const insetRefs = inset.locationFeatureIds[item.id];
  if (!mainRefs?.length || !insetRefs?.length)
    throw new Error(`Missing playable geometry refs for ${item.id}`);
  if (
    mainRefs.some((id) => !map.features[id]) ||
    insetRefs.some((id) => !inset.features[id])
  )
    throw new Error(`Unresolvable playable geometry ref for ${item.id}`);
  if (
    item.id.startsWith('non-un:') &&
    (JSON.stringify(mainRefs) !== JSON.stringify(item.geometryRefs) ||
      JSON.stringify(insetRefs) !== JSON.stringify(item.geometryRefs))
  )
    throw new Error(`Custom geometry ref parity mismatch for ${item.id}`);
}
if (
  inset.width !== map.width ||
  inset.height !== map.height ||
  inset.sourceFeatureIds.length !== insetSource.features.length ||
  new Set(inset.sourceFeatureIds).size !== insetSource.features.length
)
  throw new Error(
    'Inset projection or feature IDs are not stable and complete',
  );
if (
  inset.sourceFeatureIds.some((id) => map.supplementalFeatureIds.includes(id))
)
  throw new Error(
    'Inset source index must exclude supplemental exact features',
  );
for (const item of catalog) {
  const refs = inset.locationFeatureIds[item.id];
  if (!refs?.length || refs.some((id) => !inset.features[id]))
    throw new Error(`Missing inset geometry reference for ${item.id}`);
}
let insetRingCount = 0;
let sourceInvalidRingCount = 0;
let generatorInducedDegenerateCount = 0;
for (const [featureId, feature] of Object.entries(inset.features)) {
  if (
    !feature.paths.length ||
    !feature.polygons?.length ||
    !feature.bounds ||
    feature.bounds.length !== 4
  )
    throw new Error(`Invalid inset feature ${featureId}`);
  for (const path of feature.paths)
    if (!/^M[-0-9.,]+(?:L[-0-9.,]+)*Z$/.test(path))
      throw new Error(`Invalid inset path for ${featureId}`);
  for (const polygon of feature.polygons) {
    if (!polygon.id || !polygon.path || !polygon.rings?.length)
      throw new Error(`Invalid inset polygon for ${featureId}`);
    if (typeof polygon.island !== 'boolean')
      throw new Error(`Missing island topology for ${featureId}`);
    for (const ring of polygon.rings) {
      insetRingCount++;
      if (!ring.sourceValid) sourceInvalidRingCount++;
      if (ring.generatorInducedDegenerate) generatorInducedDegenerateCount++;
      if (
        !ring.id ||
        !['exterior', 'interior'].includes(ring.role) ||
        (ring.role === 'exterior' && ring.containmentParentRingId !== null) ||
        (ring.role === 'interior' && !ring.containmentParentRingId) ||
        !ring.path ||
        !Number.isInteger(ring.sourceVertexCount) ||
        !Number.isFinite(ring.signedArea) ||
        typeof ring.sourceClosed !== 'boolean' ||
        typeof ring.sourceValid !== 'boolean' ||
        typeof ring.projectedValid !== 'boolean' ||
        typeof ring.generatorInducedDegenerate !== 'boolean' ||
        typeof ring.valid !== 'boolean'
      )
        throw new Error(`Invalid inset ring for ${featureId}`);
      if (ring.generatorInducedDegenerate)
        throw new Error(`Generator-induced inset degeneracy in ${featureId}`);
    }
  }
}
for (const [locationId, refs] of Object.entries(overrides)) {
  if (
    !ids.has(locationId) ||
    refs.length < 2 ||
    refs.some((id) => !map.features[id])
  )
    throw new Error(`Invalid reviewed geometry override for ${locationId}`);
}
if ((overrides['iso:PSE'] ?? []).length !== 2)
  throw new Error('Expected a reviewed plural-reference observer fixture');
for (const fixture of ['iso:FRA', 'iso:USA', 'iso:FJI', 'iso:PSE', 'iso:VAT']) {
  if (!catalog.find((item) => item.id === fixture))
    throw new Error(`Missing fixture ${fixture}`);
}
console.log(
  `Data validation passed: ${catalog.length} quiz locations, ${source.features.length} base features, ${insetRingCount} inset rings (source-invalid: ${sourceInvalidRingCount}, generator-induced: ${generatorInducedDegenerateCount}).`,
);
