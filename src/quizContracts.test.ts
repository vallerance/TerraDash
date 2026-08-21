import { describe, expect, it } from 'vitest';
import candidateData from '../data/generated/non-un-candidates.json';
import mainSource from './main.tsx?raw';
import boundarySource from './quizMapBoundary.ts?raw';
import mainSource from './main.tsx?raw';
import boundarySource from './quizMapBoundary.ts?raw';
import {
  defaultCatalog,
  defaultQuiz,
  playableLocations,
  quizOptions,
  mapLayerForQuiz,
} from './quizContracts';

describe('generated quiz wiring', () => {
  it('exposes the complete generated location contract', () => {
    expect(defaultCatalog).toHaveLength(195);
    expect(playableLocations).toHaveLength(327);
    expect(defaultQuiz.locationIds).toHaveLength(195);
    expect(new Set(defaultQuiz.locationIds).size).toBe(195);
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
    expect(layer.viewBox).toBe('10 35 500 295');
    expect(layer.contextFeatureIds).not.toContain('ne:1159321369');
    expect(layer.baseLayers).toHaveLength(50);
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
        wrapActive: false,
        selectable: true,
      },
    } as (typeof quizOptions)[number];
    const layer = mapLayerForQuiz(synthetic, playableLocations[0]);
    expect(layer.viewBox).toBe('1 2 3 4');
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
    expect(worldIds).toHaveLength(195);
    expect(regionalIds).toHaveLength(worldIds.size);
    expect(new Set(regionalIds).size).toBe(worldIds.size);
    expect(regionalIds.every((id) => worldIds.has(id))).toBe(true);
  });

  it('defines 82 candidates with nonempty supplemental exact geometry refs', () => {
    expect(candidateData).toHaveLength(82);
    expect(
      candidateData.every(
        ({ geometryRefs }) =>
          geometryRefs.length > 0 &&
          geometryRefs.every((ref) =>
            /^(ne:admin1|ne:map-unit|ne:map-subunit|gb:aze-adm1):/.test(ref),
          ),
      ),
    ).toBe(true);
    expect(playableLocations.some(({ id }) => id === 'non-un:trentino')).toBe(
      false,
    );
    expect(
      playableLocations.some(({ id }) => id === 'non-un:bolzano-south-tyrol'),
    ).toBe(false);
    const nonUnQuiz = quizOptions.find(({ id }) => id === 'non-un');
    expect(nonUnQuiz?.name).toBe(
      'Non-UN Countries, Independent Territories, and Autonomous Regions',
    );
    expect(nonUnQuiz?.description).toBe(
      'Countries and regions listed in ISO 3166-1, UN M49, the List of Economies published by the World Bank Group, or under select categories in ISO 3166-2.',
    );
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
