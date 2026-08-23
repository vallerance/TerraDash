import { describe, expect, it } from 'vitest';
import locations from '../data/generated/locations.json';
import reviewed from '../data/reviewed-invariants.json';
import mainSource from './main.tsx?raw';
import boundarySource from './quizMapBoundary.ts?raw';
import map from '../data/generated/map.json';
import {
  defaultCatalog,
  defaultQuiz,
  playableLocations,
  quizOptions,
  mapLayerForQuiz,
} from './quizContracts';

const candidateData = locations.filter(({ id }) => id.startsWith('non-un:'));

describe('generated quiz wiring', () => {
  it('exposes the complete generated location contract', () => {
    expect(new Set(playableLocations.map(({ id }) => id))).toEqual(
      new Set(reviewed.locationIds),
    );
    expect(new Set(defaultQuiz.locationIds)).toEqual(
      new Set(reviewed.quizMemberships.world),
    );
    expect(
      defaultQuiz.locationIds.every((id) =>
        defaultCatalog.some((item) => item.id === id),
      ),
    ).toBe(true);
  });
});

describe('regional quiz partition', () => {
  it('defines the requested UN Countries and non-UN quizzes', () => {
    expect(quizOptions.slice(0, 8).map(({ name }) => name)).toEqual([
      'World UN Countries',
      'Africa UN Countries',
      'Asia UN Countries',
      'Europe UN Countries',
      'North America UN Countries',
      'South America UN Countries',
      'Oceania UN Countries',
      'Caribbean UN Countries',
    ]);
    expect(quizOptions).toHaveLength(10);
    expect(
      quizOptions
        .slice(0, 8)
        .every(({ name }) => name.includes('UN Countries')),
    ).toBe(true);
  });

  it('resolves mapped quiz presentation from config without quiz-specific code', () => {
    const mappedQuiz = quizOptions.find(
      (quiz) => quiz.category === 'regional' && quiz.map,
    );
    expect(mappedQuiz?.locationIds).toHaveLength(50);
    expect(mappedQuiz?.map?.baseLayerLocationIds).toHaveLength(50);
    const layer = mapLayerForQuiz(
      mappedQuiz!,
      playableLocations.find(({ id }) => id === mappedQuiz!.locationIds[0])!,
    );
    expect(layer.viewBox).toBe('-100 35 671.9444444444445 295');
    expect(layer.preserveAspectRatio).toBe('xMidYMid meet');
    expect(layer.standardParallel).toBe(38);
    expect(layer.wrapWidth).toBe(1440);
    expect(layer.seamLongitude).toBe(0);
    expect(layer.contextFeatureIds).not.toContain('ne:1159321369');
    expect(layer.baseLayers).toHaveLength(50);
  });

  it('keeps the configured regional viewport ratio and normalized geography contained', () => {
    const mappedQuiz = quizOptions.find((quiz) => quiz.map)!;
    const layer = mapLayerForQuiz(
      mappedQuiz,
      playableLocations.find(({ id }) => id === mappedQuiz.locationIds[0])!,
    );
    const [, , width, height] = layer.viewBox.split(/\s+/).map(Number);
    expect(width / height).toBeCloseTo(41 / 18, 3);
    const points = (paths: string[]) =>
      paths.flatMap((path) =>
        [...path.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(([, x, y]) => [
          Number(x),
          Number(y),
        ]),
      );
    const bounds = (paths: string[]) => {
      const values = points(paths);
      return [
        Math.min(...values.map(([x]) => x)),
        Math.max(...values.map(([x]) => x)),
        Math.min(...values.map(([, y]) => y)),
        Math.max(...values.map(([, y]) => y)),
      ];
    };
    const statePaths = layer.baseLayers.flatMap(({ paths }) => paths);
    const stateBounds = bounds(
      statePaths.map((path) =>
        path.replace(/(-?[\d.]+),/g, (value) => {
          const x = Number(value.slice(0, -1));
          return `${x > layer.wrapWidth / 2 ? x - layer.wrapWidth : x},`;
        }),
      ),
    );
    const contextBounds = (id: keyof typeof map.features) =>
      bounds(map.features[id].paths);
    const [, minY, widthValue, heightValue] = layer.viewBox
      .split(/\s+/)
      .map(Number);
    const [minX] = layer.viewBox.split(/\s+/).map(Number);
    const maxY = minY + heightValue;
    const maxX = minX + widthValue;
    for (const [left, right, top, bottom] of [
      stateBounds,
      contextBounds('ne:1159321055'),
    ]) {
      expect(left).toBeGreaterThan(minX);
      expect(right).toBeLessThan(maxX);
      expect(top).toBeGreaterThan(minY);
      expect(bottom).toBeLessThan(maxY);
    }
    const [contextLeft, contextRight, contextTop, contextBottom] =
      contextBounds('ne:1159320467');
    expect(contextRight).toBeGreaterThan(minX);
    expect(contextLeft).toBeLessThan(maxX);
    expect(contextBottom).toBeGreaterThan(minY);
    expect(contextTop).toBeLessThan(maxY);
  });

  it('supports a second mapped quiz through a data-shaped config only', () => {
    const synthetic = {
      id: 'synthetic-mapped',
      name: 'Synthetic mapped quiz',
      locationIds: ['iso:AFG'],
      map: {
        contextFeatureExclusions: [],
        baseLayerLocationIds: ['iso:AFG'],
        viewBox: '1 2 3 4',
        preserveAspectRatio: 'xMinYMin meet',
        standardParallel: 25,
        wrapWidth: 360,
        seamLongitude: -30,
        wrapActive: false,
        selectable: true,
      },
    } as (typeof quizOptions)[number];
    const layer = mapLayerForQuiz(synthetic, playableLocations[0]);
    expect(layer.viewBox).toBe('1 2 3 4');
    expect(layer.preserveAspectRatio).toBe('xMinYMin meet');
    expect(layer.standardParallel).toBe(25);
    expect(layer.wrapWidth).toBe(360);
    expect(layer.seamLongitude).toBe(-30);
    expect(layer.wrapActive).toBe(false);
    expect(layer.selectable).toBe(true);
  });

  it('keeps rendering and boundary code free of quiz-specific geography branches', () => {
    for (const source of [mainSource, boundarySource])
      expect(source).not.toMatch(/us-states|US-[A-Z]{2}|stateSet|regional-map/);
  });

  it('keeps render and boundary code free of quiz-specific geography branches', () => {
    for (const source of [mainSource, boundarySource])
      expect(source).not.toMatch(/us-states|US-[A-Z]{2}|stateSet|regional-map/);
  });

  it('partitions the existing world dataset exactly once regionally', () => {
    const worldIds = new Set(defaultQuiz.locationIds);
    const regionalIds = quizOptions
      .slice(1, 8)
      .flatMap(({ locationIds }) => locationIds);
    expect(regionalIds).toHaveLength(worldIds.size);
    expect(new Set(regionalIds).size).toBe(worldIds.size);
    expect(regionalIds.every((id) => worldIds.has(id))).toBe(true);
  });

  it('preserves candidate evidence and the overlap exclusions', () => {
    expect(new Set(candidateData.map(({ id }) => id))).toEqual(
      new Set(reviewed.relationships.nonUnCandidateIds),
    );
    expect(
      candidateData.every(
        ({ geometryRefs }) =>
          geometryRefs.length > 0 &&
          geometryRefs.every(
            (ref) =>
              /^(ne:admin1|ne:map-unit|ne:map-subunit|gb:aze-adm1|ne:disputed):/.test(
                ref,
              ) || ref.startsWith('ne:'),
          ),
      ),
    ).toBe(true);
    expect(playableLocations.some(({ id }) => id === 'non-un:trentino')).toBe(
      true,
    );
    expect(
      playableLocations.some(({ id }) => id === 'non-un:bolzano-south-tyrol'),
    ).toBe(true);
    const nonUnQuiz = quizOptions.find(({ id }) => id === 'non-un');
    expect(nonUnQuiz?.name).toBe(
      'Non-UN Countries, Independent Territories, and Autonomous Regions',
    );
    expect(nonUnQuiz?.description).toBe(
      "Non-UN countries and regions listed in ISO 3166-1, UN M49, Natural Earth's admin-0 under countries or breakaway territories, or ISO 3166-2 under select categories.",
    );
    expect(new Set(nonUnQuiz?.locationIds)).toEqual(
      new Set(reviewed.relationships.nonUnMembers),
    );
    expect(nonUnQuiz?.locationIds).not.toContain('non-un:trentino');
    expect(nonUnQuiz?.locationIds).not.toContain('non-un:bolzano-south-tyrol');
    expect(
      [
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
      ].every(
        (id) => !playableLocations.some((location) => location.id === id),
      ),
    ).toBe(true);
  });

  it('maps New Caledonia to its exact features, not British Columbia', () => {
    const newCaledonia = candidateData.find(
      ({ id }) => id === 'non-un:new-caledonia',
    );
    expect(newCaledonia?.geometryRefs).toEqual([
      'ne:map-unit:1159320641',
      'ne:map-subunit:1159320641',
    ]);
    expect(newCaledonia?.geometryRefs).not.toContain('ne:admin1:1159307717');
  });

  it('maps Nakhchivan to the full autonomous republic, not its capital city', () => {
    const nakhchivan = candidateData.find(
      ({ id }) => id === 'non-un:nakhchivan',
    );
    expect(nakhchivan?.geometryRefs).toEqual([
      'gb:aze-adm1:63332228B45413776644545',
    ]);
    expect(nakhchivan!.bounds[2] - nakhchivan!.bounds[0]).toBeGreaterThan(4);
    expect(nakhchivan!.bounds[3] - nakhchivan!.bounds[1]).toBeGreaterThan(3);
  });
});
