import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  expectReject,
  indexNamespace,
  resolveLocationFeatures,
  validateQuizMembership,
  validateReplacementContract,
} from './map-contract.mjs';

const root = new URL('./fixtures/contract/', import.meta.url);
const read = (name) => JSON.parse(fs.readFileSync(new URL(name, root), 'utf8'));
const locations = read('locations.json');
const quizzes = read('quizzes.json');
const sources = read('geometry-sources.json');
const base = read('base.geojson').features;
const alternate = read('alternate.geojson').features;
const canonical = base.map((feature) => ({
  id: `fixture:base:${feature.properties.id}`,
  keys: [feature.properties.id],
  geometry: feature.geometry,
}));
const alternateFeatures = alternate.map((feature) => ({
  id: `fixture:alternate:${feature.properties.id}`,
  keys: [feature.properties.id],
  geometry: feature.geometry,
}));
const featuresById = new Map(canonical.map((feature) => [feature.id, feature]));
const namespaces = new Map([
  ['fixture-base', indexNamespace('fixture-base', canonical)],
  ['fixture-alternate', indexNamespace('fixture-alternate', alternateFeatures)],
]);
const resolvedLocations = resolveLocationFeatures(locations, { namespaces, featuresById });
validateQuizMembership(locations, quizzes);
const replacement = sources.replacements[0];
validateReplacementContract({
  locations,
  resolvedLocations,
  replacements: sources.replacements,
  sources: new Set(Object.keys(sources.sources)),
  appliedCanonicalFeatureIds: new Set([replacement.canonicalFeatureId]),
  alternateNamespaces: new Map([
    ['fixture-alternate', indexNamespace('fixture-alternate', alternateFeatures)],
  ]),
});
assert.equal(replacement.source, 'fixture-alternate');
assert.equal(alternateFeatures.find(({ keys }) => keys.includes(replacement.featureKey)).geometry.coordinates[0][0][0], 10);
assert.equal(resolvedLocations.find(({ location }) => location.id === replacement.locationId).matches[0].id, replacement.canonicalFeatureId);

const valid = {
  locations,
  resolvedLocations,
  replacements: sources.replacements,
  sources: new Set(Object.keys(sources.sources)),
  appliedCanonicalFeatureIds: new Set([replacement.canonicalFeatureId]),
  alternateNamespaces: new Map([
    ['fixture-alternate', indexNamespace('fixture-alternate', alternateFeatures)],
  ]),
};
expectReject(() => resolveLocationFeatures([{ ...locations[0], resolution: { kind: 'source-keys', keys: [{ source: 'missing', key: 'ONE' }] } }], { namespaces, featuresById }), /Unknown canonical/);
expectReject(() => validateReplacementContract({ ...valid, replacements: [{ ...replacement, source: 'missing' }] }), /unknown source/);
expectReject(() => validateReplacementContract({ ...valid, replacements: [{ ...replacement, featureKey: 'missing' }] }), /exactly once/);
expectReject(() => validateReplacementContract({ ...valid, alternateNamespaces: new Map([['fixture-alternate', indexNamespace('fixture-alternate', [...alternateFeatures, alternateFeatures[0]])]]) }), /exactly once/);
expectReject(() => validateReplacementContract({ ...valid, replacements: [{ ...replacement, locationId: 'missing' }] }), /unknown location/);
expectReject(() => validateReplacementContract({ ...valid, replacements: [{ ...replacement, canonicalFeatureId: 'fixture:base:ONE' }] }), /not owned/);
expectReject(() => validateReplacementContract({ ...valid, replacements: [replacement, replacement] }), /Duplicate/);
expectReject(() => validateReplacementContract({ ...valid, replacements: [{ ...replacement, source: '' }] }), /complete/);
expectReject(() => resolveLocationFeatures([{ ...locations[0], resolution: { kind: 'bad' } }], { namespaces, featuresById }), /Invalid/);
expectReject(() => validateQuizMembership(locations, [{ ...quizzes[0], locationIds: ['fixture:new'] }]), /Unresolved/);
expectReject(() => validateQuizMembership(locations, [{ ...quizzes[0], locationIds: [locations[0].id, locations[0].id] }]), /Duplicate/);
expectReject(() => validateQuizMembership(locations, [quizzes[0], quizzes[0]]), /Duplicate quiz/);
expectReject(() => validateReplacementContract({ ...valid, replacements: [{ ...replacement, canonicalFeatureId: 'fixture:unknown' }] }), /not owned/);
expectReject(() => validateReplacementContract({ ...valid, appliedCanonicalFeatureIds: new Set() }), /unused/);
expectReject(() => validateReplacementContract({ ...valid, sources: new Set(['fixture-alternate', 'fixture-unused']), rejectUnusedSources: true }), /unused/);

console.log('Production map-contract fixture passed: second source, replacement provenance, new location/quiz, and negative cases.');
