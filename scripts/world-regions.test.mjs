import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const targetNames = [
  'Africa',
  'Antarctica',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Oceania',
  'Arctic Ocean',
  'Atlantic Ocean',
  'Indian Ocean',
  'Pacific Ocean',
  'Southern Ocean',
];

describe('world-region derivation', () => {
  it('is repeatable and emits exactly the mapped twelve features', () => {
    const dir = mkdtempSync(join(tmpdir(), 'terradash-world-'));
    const first = join(dir, 'first.geojson');
    const second = join(dir, 'second.geojson');
    for (const output of [first, second])
      execFileSync(
        process.execPath,
        ['scripts/derive-world-regions.mjs', '--output', output],
        {
          cwd: root,
        },
      );
    expect(readFileSync(first)).toEqual(readFileSync(second));
    expect(readFileSync(first)).toEqual(
      readFileSync(
        new URL('../data/source/world-regions.geojson', import.meta.url),
      ),
    );
    const value = JSON.parse(readFileSync(first));
    expect(value.type).toBe('FeatureCollection');
    expect(
      value.features.map(({ id, properties }) => [id, properties.name]),
    ).toEqual(
      targetNames.map((name) => [
        `world:${name.toLowerCase().replaceAll(' ', '-')}`,
        name,
      ]),
    );
    expect(value.features).toHaveLength(12);
    expect(
      value.features.every(({ geometry }) => geometry.type === 'MultiPolygon'),
    ).toBe(true);
    const land = value.features.slice(0, 7);
    expect(
      land.every(({ properties }) => properties.source.startsWith('land:')),
    ).toBe(true);
    expect(
      land.every(({ properties }) => !properties.source.includes('admin-0')),
    ).toBe(true);
    const boundaries = JSON.parse(
      readFileSync(
        new URL(
          '../data/source/world-region-boundaries.geojson',
          import.meta.url,
        ),
      ),
    );
    expect(boundaries.features.map(({ properties }) => properties.id)).toEqual([
      'north-america',
      'south-america',
      'africa',
      'europe',
      'asia',
      'oceania',
      'antarctica',
    ]);
  });
});
