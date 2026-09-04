#!/usr/bin/env node

/**
 * Derive the twelve selectable world regions without hand-authoring geometry.
 *
 * Dissolve pinned physical land once, intersect it with pinned continent
 * geometries, and flatten exact named marine polygons into deterministic
 * world features.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import polygonClipping from 'polygon-clipping';

const ROOT = resolve(import.meta.dirname, '..');
const LAND_PATH = resolve(ROOT, '.scratch/ne_10m_land.geojson');
const REGION_PATH = resolve(
  ROOT,
  '.scratch/ne_10m_geography_regions_polys.geojson',
);
const MARINE_PATH = resolve(
  ROOT,
  '.scratch/ne_10m_geography_marine_polys.geojson',
);
const LAND_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_10m_land.geojson';
const REGION_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_10m_geography_regions_polys.geojson';
const MARINE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_10m_geography_marine_polys.geojson';
const LAND_SHA256 =
  '1ac90796408bc6ad6911d69448485d3c4dbf2190370080368a09976e1c9f7416';
const REGION_SHA256 =
  'b7b26e50ea917d3696aec87f932def2bf5f890f5770e441d59c162c6f4c92a77';
const MARINE_SHA256 =
  '53f865e8ffa966cdd402145c82c5cd14ee7ce974cd0eb9a3f59f03a4cfd2d66c';

const continents = [
  ['africa', 'Africa', 'Africa'],
  ['antarctica', 'Antarctica', 'Antarctica'],
  ['asia', 'Asia', 'Asia'],
  ['europe', 'Europe', 'Europe'],
  ['north-america', 'North America', 'North America'],
  ['south-america', 'South America', 'South America'],
  ['oceania', 'Oceania'],
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

async function ensureInput(path, url) {
  if (!existsSync(path)) {
    mkdirSync(resolve(ROOT, '.scratch'), { recursive: true });
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(
        `Unable to fetch pinned source ${url}: ${response.status}`,
      );
    writeFileSync(path, Buffer.from(await response.arrayBuffer()));
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

function asMultiPolygon(feature) {
  return polygonParts(feature);
}

function unionAll(polygons) {
  if (!polygons.length) throw new Error('Cannot union an empty polygon set');
  return polygons.reduce((result, polygon) =>
    polygonClipping.union(result, polygon),
  );
}

function regionLand(land, physicalRegions) {
  const dissolved = unionAll(land.features.map(asMultiPolygon));
  const regions = new Map();
  for (const [id, name] of continents) {
    const matches = physicalRegions.features.filter(
      ({ properties }) =>
        properties?.REGION === name && properties?.FEATURECLA === 'Continent',
    );
    if (matches.length !== 1)
      throw new Error(
        `Expected exactly one Natural Earth continent geometry for ${name}; found ${matches.length}`,
      );
    const [feature] = matches;
    const coordinates = polygonClipping.intersection(
      dissolved,
      asMultiPolygon(feature),
    );
    if (!coordinates.length)
      throw new Error(`Empty continent geometry: ${name}`);
    regions.set(id, coordinates);
  }
  return regions;
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

function derive(land, physicalRegions, marine) {
  const features = [];
  const regions = regionLand(land, physicalRegions);
  for (const [id, name] of continents) {
    const coordinates = regions.get(id);
    if (!coordinates?.length)
      throw new Error(`No geometry selected for ${name}`);
    features.push({
      type: 'Feature',
      id: `world:${id}`,
      properties: {
        id: `world:${id}`,
        name,
        source: `land:ne_10m_land∩ne_10m_geography_regions_polys:${name}`,
      },
      geometry: { type: 'MultiPolygon', coordinates },
    });
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
await ensureInput(LAND_PATH, LAND_URL);
await ensureInput(REGION_PATH, REGION_URL);
await ensureInput(MARINE_PATH, MARINE_URL);
const result = derive(
  readPinned(LAND_PATH, LAND_SHA256),
  readPinned(REGION_PATH, REGION_SHA256),
  readPinned(MARINE_PATH, MARINE_SHA256),
);
const serialized = `${JSON.stringify(result, null, 2)}\n`;
if (output) writeFileSync(output, serialized);
else process.stdout.write(serialized);
