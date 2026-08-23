import assert from 'node:assert/strict';

export function indexNamespace(
  source,
  features,
  keyOf = (feature) => feature.keys ?? [],
) {
  const index = new Map();
  for (const feature of features) {
    for (const key of new Set(keyOf(feature).filter(Boolean))) {
      const matches = index.get(key) ?? [];
      matches.push(feature);
      index.set(key, matches);
    }
  }
  return { source, index };
}

export function sourcePropertyKeys(properties = {}) {
  return [
    properties.iso_3166_2,
    properties.ISO_A2,
    properties.ISO_A2_EH,
    properties.iso_a2,
    properties.SU_A3,
    properties.ADM0_A3,
    properties.adm0_a3,
    properties.name,
    properties.name_en,
    properties.NAME,
    properties.NAME_LONG,
    properties.SUBUNIT,
    properties.shapeID,
    properties.shapeName,
    properties.shapeISO,
    properties.shapeGroup,
    properties.shapeType,
    properties.BRK_A3,
    properties.BRK_NAME,
  ].filter(Boolean);
}

export function resolveLocationFeatures(
  locations,
  { namespaces, featuresById },
) {
  return locations.map((location) => {
    const resolution = location.resolution;
    if (!resolution || !['source-keys', 'exact-refs'].includes(resolution.kind))
      throw new Error(`Invalid location resolution for ${location.id}`);
    const matches =
      resolution.kind === 'exact-refs'
        ? resolution.refs.map((ref) => featuresById.get(ref)).filter(Boolean)
        : resolution.keys.flatMap(({ source, key }) => {
            const namespace = namespaces.get(source);
            if (!namespace)
              throw new Error(
                `Unknown canonical location source namespace ${source}`,
              );
            return namespace.index.get(key) ?? [];
          });
    if (!matches.length)
      throw new Error(
        `No canonical feature for ${location.id} (${location.name})`,
      );
    return { location, matches };
  });
}

export function validateReplacementContract({
  locations,
  resolvedLocations,
  replacements,
  sources,
  alternateNamespaces,
  appliedCanonicalFeatureIds,
  rejectUnusedSources = false,
}) {
  const locationsById = new Map(
    locations.map((location) => [location.id, location]),
  );
  const resolvedById = new Map(
    resolvedLocations.map(({ location, matches }) => [location.id, matches]),
  );
  const seenIdentity = new Set();
  const seenCanonical = new Map();
  const usedSources = new Set();
  for (const replacement of replacements ?? []) {
    if (
      !replacement?.locationId ||
      !replacement.canonicalFeatureId ||
      !replacement.source ||
      !replacement.featureKey
    )
      throw new Error(
        'Geometry replacements require complete per-replacement provenance',
      );
    if (!locationsById.has(replacement.locationId))
      throw new Error(
        `Geometry replacement references unknown location ${replacement.locationId}`,
      );
    const identity = `${replacement.locationId}/${replacement.canonicalFeatureId}`;
    if (seenIdentity.has(identity))
      throw new Error(`Duplicate geometry replacement identity ${identity}`);
    seenIdentity.add(identity);
    const prior = seenCanonical.get(replacement.canonicalFeatureId);
    if (prior && prior !== replacement.locationId)
      throw new Error(
        `Canonical feature replacement belongs to multiple locations: ${replacement.canonicalFeatureId}`,
      );
    seenCanonical.set(replacement.canonicalFeatureId, replacement.locationId);
    const owned = (resolvedById.get(replacement.locationId) ?? []).some(
      ({ id }) => id === replacement.canonicalFeatureId,
    );
    if (!owned)
      throw new Error(
        `Geometry replacement canonical feature is not owned by ${replacement.locationId}: ${replacement.canonicalFeatureId}`,
      );
    if (!sources.has(replacement.source))
      throw new Error(
        `Geometry replacement references unknown source ${replacement.source}`,
      );
    const namespace = alternateNamespaces.get(replacement.source);
    if (!namespace)
      throw new Error(
        `Missing alternate source namespace ${replacement.source}`,
      );
    const matches = namespace.index.get(replacement.featureKey) ?? [];
    if (matches.length !== 1)
      throw new Error(
        `Geometry replacement feature key must resolve exactly once: ${replacement.source}/${replacement.featureKey}`,
      );
    usedSources.add(replacement.source);
  }
  if (appliedCanonicalFeatureIds) {
    for (const replacement of replacements ?? [])
      if (!appliedCanonicalFeatureIds.has(replacement.canonicalFeatureId))
        throw new Error(
          `Geometry replacement is unused: ${replacement.canonicalFeatureId}`,
        );
  }
  if (rejectUnusedSources)
    for (const source of sources)
      if (!usedSources.has(source))
        throw new Error(`Geometry source is unused: ${source}`);
  return { usedSources };
}

export function validateQuizMembership(locations, quizzes) {
  const ids = new Set(locations.map(({ id }) => id));
  if (ids.size !== locations.length)
    throw new Error('Location IDs must be unique');
  const quizIds = new Set();
  for (const quiz of quizzes) {
    if (!quiz?.id || quizIds.has(quiz.id))
      throw new Error(`Duplicate quiz ID ${quiz?.id ?? ''}`);
    quizIds.add(quiz.id);
    const members = new Set(quiz.locationIds ?? []);
    if (members.size !== (quiz.locationIds ?? []).length)
      throw new Error(`Duplicate quiz membership in ${quiz.id}`);
    for (const id of members)
      if (!ids.has(id))
        throw new Error(`Unresolved quiz membership ${quiz.id}/${id}`);
  }
}

export function expectReject(action, pattern) {
  assert.throws(action, pattern);
}
