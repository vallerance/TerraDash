#!/usr/bin/env node

/**
 * Derive the twelve selectable world regions without hand-authoring geometry.
 *
 * This intentionally assembles source polygons into MultiPolygons rather than
 * performing a floating-point topology operation. The source rings and their
 * winding are preserved byte-for-byte in a deterministic feature collection.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const ADMIN_PATH = resolve(
  ROOT,
  'data/source/ne_10m_admin_0_countries.geojson',
);
const MARINE_PATH = resolve(
  ROOT,
  '.scratch/ne_10m_geography_marine_polys.geojson',
);
const MARINE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_10m_geography_marine_polys.geojson';
const ADMIN_SHA256 =
  '239eec57ac17f100a11e2536cffc56752c318b50ae765b0918ff7aab4ce8f255';
const MARINE_SHA256 =
  '53f865e8ffa966cdd402145c82c5cd14ee7ce974cd0eb9a3f59f03a4cfd2d66';

const continents = [
  ['africa', 'Africa', 'Africa'],
  ['antarctica', 'Antarctica', 'Antarctica'],
  ['asia', 'Asia', 'Asia'],
  ['europe', 'Europe', 'Europe'],
  ['north-america', 'North America', 'North America'],
  ['south-america', 'South America', 'South America'],
  ['australia', 'Australia', 'Oceania'],
];

const oceans = [
  ['arctic-ocean', 'Arctic Ocean', ['Arctic Ocean']],
  [
    'atlantic-ocean',
    'Atlantic Ocean',
    ['North Atlantic Ocean', 'South Atlantic Ocean'],
  ],
  ['indian-ocean', 'Indian Ocean', ['INDIAN OCEAN']],
  [
    'pacific-ocean',
    'Pacific Ocean',
    ['North Pacific Ocean', 'South Pacific Ocean'],
  ],
  ['southern-ocean', 'Southern Ocean', ['SOUTHERN OCEAN']],
];

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function readPinned(path, expectedSha) {
  const actualSha = sha256(path);
  if (actualSha !== expectedSha) {
    throw new Error(
      `Checksum mismatch for ${path}: expected ${expectedSha}, got ${actualSha}`,
    );
  }
  const value = JSON.parse(readFileSync(path, 'utf8'));
  if (value.type !== 'FeatureCollection' || !Array.isArray(value.features)) {
    throw new Error(`Expected a GeoJSON FeatureCollection: ${path}`);
  }
  return value;
}

async function ensureMarineInput() {
  if (!existsSync(MARINE_PATH)) {
    mkdirSync(resolve(ROOT, '.scratch'), { recursive: true });
    const response = await fetch(MARINE_URL);
    if (!response.ok)
      throw new Error(
        `Unable to fetch pinned marine source: ${response.status}`,
      );
    writeFileSync(MARINE_PATH, Buffer.from(await response.arrayBuffer()));
  }
}

function polygonParts(feature) {
  const geometry = feature.geometry;
  if (geometry?.type === 'Polygon') return [geometry.coordinates];
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates;
  throw new Error(
    `Unsupported geometry for ${feature.properties?.name ?? feature.id}`,
  );
}

function groupedFeature(id, name, source, features) {
  const coordinates = features.flatMap(polygonParts);
  if (coordinates.length === 0)
    throw new Error(`No geometry selected for ${name}`);
  return {
    type: 'Feature',
    id: `world:${id}`,
    properties: { id: `world:${id}`, name, source },
    geometry: { type: 'MultiPolygon', coordinates },
  };
}

function derive(admin, marine) {
  const features = [];
  for (const [id, name, sourceName] of continents) {
    const selected = admin.features.filter(
      (feature) => feature.properties?.CONTINENT === sourceName,
    );
    if (selected.length === 0)
      throw new Error(`No admin features for ${sourceName}`);
    features.push(
      groupedFeature(id, name, `admin-0:CONTINENT=${sourceName}`, selected),
    );
  }

  const marineByName = new Map();
  for (const feature of marine.features) {
    const name = feature.properties?.name;
    if (name)
      marineByName.set(name, (marineByName.get(name) ?? []).concat(feature));
  }
  const expectedMarineNames = new Set(oceans.flatMap(([, , names]) => names));
  for (const name of expectedMarineNames) {
    if (!marineByName.has(name))
      throw new Error(`Missing marine feature name: ${name}`);
  }

  for (const [id, name, sourceNames] of oceans) {
    const selected = sourceNames.flatMap((sourceName) =>
      marineByName.get(sourceName),
    );
    features.push(
      groupedFeature(
        id,
        name,
        `marine:name=${sourceNames.join('+')}`,
        selected,
      ),
    );
  }

  if (
    features.length !== 12 ||
    new Set(features.map((feature) => feature.id)).size !== 12
  ) {
    throw new Error(
      'Derivation did not produce exactly twelve unique features',
    );
  }
  return { type: 'FeatureCollection', features };
}

function outputPath(argv) {
  const index = argv.indexOf('--output');
  return index === -1 ? null : resolve(process.cwd(), argv[index + 1]);
}

const output = outputPath(process.argv.slice(2));
if (process.argv.includes('--output') && !output)
  throw new Error('--output requires a path');
await ensureMarineInput();
const result = derive(
  readPinned(ADMIN_PATH, ADMIN_SHA256),
  readPinned(MARINE_PATH, MARINE_SHA256),
);
const serialized = `${JSON.stringify(result, null, 2)}\n`;
if (output) writeFileSync(output, serialized);
else process.stdout.write(serialized);
