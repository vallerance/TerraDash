import assert from 'node:assert/strict';

const validate = ({ locations, quizzes, sources, replacements }) => {
  const ids = new Set(locations.map(({ id }) => id));
  assert.equal(ids.size, locations.length, 'location IDs must be unique');
  for (const location of locations) {
    assert.ok(location.id && location.name && location.resolution);
    assert.ok(['source-keys', 'exact-refs'].includes(location.resolution.kind));
    if (location.resolution.kind === 'source-keys')
      for (const key of location.resolution.keys)
        assert.ok(key.source && key.key, 'source keys require a namespace');
  }
  for (const quiz of quizzes) {
    assert.ok(quiz.locationIds.every((id) => ids.has(id)));
    assert.equal(new Set(quiz.locationIds).size, quiz.locationIds.length);
  }
  const keys = new Set();
  for (const replacement of replacements) {
    assert.ok(
      replacement.locationId &&
        replacement.canonicalFeatureId &&
        replacement.source &&
        replacement.featureKey,
      'replacement provenance is complete',
    );
    assert.ok(sources[replacement.source], 'replacement source exists');
    const key = `${replacement.source}/${replacement.featureKey}`;
    assert.ok(!keys.has(key), 'replacement feature keys are unique');
    keys.add(key);
  }
};

const source = {
  'fixture-source': { path: 'fixture.geojson' },
};
const locations = [
  {
    id: 'fixture:one',
    name: 'Fixture One',
    resolution: { kind: 'source-keys', keys: [{ source: 'fixture', key: 'ONE' }] },
  },
  {
    id: 'fixture:two',
    name: 'Fixture Two',
    resolution: { kind: 'exact-refs', refs: ['fixture:feature:two'] },
  },
];
validate({
  locations,
  quizzes: [{ id: 'fixture-quiz', locationIds: ['fixture:one', 'fixture:two'] }],
  sources: source,
  replacements: [
    {
      locationId: 'fixture:two',
      canonicalFeatureId: 'fixture:feature:two',
      source: 'fixture-source',
      featureKey: 'TWO',
    },
  ],
});

const rejects = (value, message) => assert.throws(() => validate(value), message);
const base = {
  locations,
  quizzes: [{ id: 'fixture-quiz', locationIds: ['fixture:one'] }],
  sources: source,
  replacements: [
    {
      locationId: 'fixture:two',
      canonicalFeatureId: 'fixture:feature:two',
      source: 'fixture-source',
      featureKey: 'TWO',
    },
  ],
};
rejects({ ...base, replacements: [{ ...base.replacements[0], featureKey: '' }] }, /provenance/);
rejects({ ...base, replacements: [{ ...base.replacements[0], source: 'missing' }] }, /source/);
rejects(
  { ...base, replacements: [base.replacements[0], base.replacements[0]] },
  /unique/,
);

console.log('Generic location, quiz, alternate-source, and negative fixtures passed.');
