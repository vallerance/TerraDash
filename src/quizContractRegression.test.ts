import { describe, expect, it } from 'vitest';
import locations from '../data/generated/locations.json';
import reviewed from '../data/reviewed-invariants.json';
import mainSource from './main.tsx?raw';
import boundarySource from './quizMapBoundary.ts?raw';
import quizHomeSource from './quiz/QuizHome.tsx?raw';
import quizDetailsSource from './quizSelection/QuizDetailsDialog.tsx?raw';
import appChromeSource from './shell/AppChrome.tsx?raw';
import thumbnailSource from './shell/QuizThumbnail.tsx?raw';
import map from '../data/generated/map.json';
import {
  defaultCatalog,
  defaultQuiz,
  playableLocations,
  quizOptions,
} from './contracts/quiz';
import { playableLocationsById } from './contracts/playableLocation';
import { mapLayerForQuiz } from './quizMapBoundary';
import { createMapProjection } from './mapProjection';
import { pathPoints, type Point } from './footprint';

const candidateData = locations.filter(({ id }) => id.startsWith('non-un:'));

describe('generated quiz wiring', () => {
  it('exposes the complete generated location contract', () => {
    expect(
      new Set(
        playableLocations
          .map(({ id }) => id)
          .filter((id) => !id.startsWith('world:')),
      ),
    ).toEqual(new Set(reviewed.locationIds));
    expect(new Set(defaultQuiz.locationIds)).toEqual(
      new Set(reviewed.quizMemberships.world),
    );
    expect(
      defaultQuiz.locationIds.every((id) =>
        defaultCatalog.some((item) => item.id === id),
      ),
    ).toBe(true);
  });

  it('keeps China answer membership separate from its high-detail base layer', () => {
    const china = quizOptions.find(({ id }) => id === 'china-provinces')!;
    const excluded = ['CN-GX', 'CN-NM', 'CN-NX', 'CN-XJ', 'CN-XZ'];
    const layer = mapLayerForQuiz(china, playableLocationsById.get('CN-AH')!);

    expect(china.locationIds).toHaveLength(26);
    expect(new Set(china.locationIds).size).toBe(26);
    expect(china.locationIds).not.toEqual(expect.arrayContaining(excluded));
    expect(layer.baseLayers.map(({ id }) => id)).toEqual(
      expect.arrayContaining(excluded),
    );
    expect(layer.baseLayers).toHaveLength(31);
  });

  it('models the US quiz as exactly 51 identities including the canonical DC feature', () => {
    const us = quizOptions.find(({ id }) => id === 'us-states')!;
    const dc = playableLocationsById.get('US-DC')!;

    expect(us.locationIds).toHaveLength(51);
    expect(us.locationIds).toContain('US-DC');
    expect(dc.name).toBe('District of Columbia');
    expect(dc.geometryRefs).toEqual(['ne:admin1:1159315327']);
    expect(us.map?.baseLayerLocationIds).toHaveLength(51);
    expect(us.map?.baseLayerLocationIds).toContain('US-DC');
  });
});

describe('canonical quiz presentation contract', () => {
  it('keeps copy, menu labels, and thumbnail viewBoxes declarative', () => {
    expect(quizOptions.length).toBeGreaterThan(0);
    for (const quiz of quizOptions) {
      expect(quiz.description).toBeTruthy();
      expect(quiz.menuLabel).toBeTruthy();
      expect(quiz.thumbnailViewBox).toBeTruthy();
    }
    const expectedViewBoxes: Record<string, string> = {
      world: '0 0 1440 720',
      africa: '600 140 380 430',
      asia: '780 80 500 380',
      europe: '600 70 330 260',
      'north-america': '250 80 500 360',
      'south-america': '420 300 300 360',
      oceania: '1030 330 360 270',
      caribbean: '430 220 300 190',
      'non-un': '0 0 1440 720',
      'us-states': '0 0 1440 720',
    };
    for (const [id, viewBox] of Object.entries(expectedViewBoxes))
      expect(quizOptions.find((quiz) => quiz.id === id)?.thumbnailViewBox).toBe(
        viewBox,
      );
  });

  it('keeps presentation consumers free of quiz-ID compatibility predicates', () => {
    for (const source of [
      quizHomeSource,
      quizDetailsSource,
      appChromeSource,
      thumbnailSource,
    ]) {
      expect(source).not.toMatch(/quiz\.id\s*===\s*['\"]/);
      expect(source).not.toMatch(/thumbnailViewBoxes/);
      expect(source).not.toMatch(/UN Countries\)?\s*\)/);
    }
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
    expect(quizOptions.some(({ id }) => id === 'non-un')).toBe(true);
    expect(
      quizOptions
        .slice(0, 8)
        .every(({ name }) => name.includes('UN Countries')),
    ).toBe(true);
  });

  it('resolves every mapped quiz presentation from config without quiz-specific code', () => {
    const mappedQuizzes = quizOptions.filter(
      (quiz) => quiz.map && quiz.category !== 'world',
    );
    expect(mappedQuizzes.length).toBeGreaterThan(0);
    for (const quiz of mappedQuizzes) {
      const layer = mapLayerForQuiz(
        quiz,
        playableLocations.find(({ id }) => id === quiz.locationIds[0])!,
      );
      expect(layer.viewBox).toMatch(/^[-\d.]+ [-\d.]+ [\d.]+ [\d.]+$/);
      expect(layer.preserveAspectRatio).toBeTruthy();
      expect(layer.baseLayers).toHaveLength(
        quiz.map!.baseLayerLocationIds!.length,
      );
      expect(layer.contextFeatureIds.length).toBeGreaterThan(0);
    }
  });

  it('keeps every mapped quiz contained after projection and preserves visible context', () => {
    const bounds = (paths: string[], project: (point: Point) => Point) => {
      const points = pathPoints(paths).map(project);
      return [
        Math.min(...points.map(([x]) => x)),
        Math.max(...points.map(([x]) => x)),
        Math.min(...points.map(([, y]) => y)),
        Math.max(...points.map(([, y]) => y)),
      ] as [number, number, number, number];
    };
    const intersects = (
      first: [number, number, number, number],
      second: [number, number, number, number],
    ) =>
      first[0] <= second[1] &&
      first[1] >= second[0] &&
      first[2] <= second[3] &&
      first[3] >= second[2];

    for (const quiz of quizOptions.filter(
      (candidate) => candidate.map && candidate.category !== 'world',
    )) {
      const active = playableLocations.find(
        ({ id }) => id === quiz.locationIds[0],
      )!;
      const layer = mapLayerForQuiz(quiz, active);
      const [minX, minY, width, height] = layer.viewBox
        .split(/\s+/)
        .map(Number);
      const projection = createMapProjection(
        layer.standardParallel,
        minY + height / 2,
      );
      const projectRendered = ([x, y]: Point): Point => [
        x > layer.wrapWidth / 2 ? x - layer.wrapWidth : x,
        projection.y(y),
      ];
      const viewport: [number, number, number, number] = [
        minX,
        minX + width,
        minY,
        minY + height,
      ];
      const viewportCenterX = minX + width / 2;
      const baseBounds = layer.baseLayers.map(({ paths }) =>
        bounds(paths, ([x, y]) => [
          x +
            Math.round((viewportCenterX - x) / layer.wrapWidth) *
              layer.wrapWidth,
          projectRendered([x, y])[1],
        ]),
      );
      for (const rendered of baseBounds) {
        expect(rendered[0]).toBeGreaterThanOrEqual(viewport[0]);
        expect(rendered[1]).toBeLessThanOrEqual(viewport[1]);
        expect(rendered[2]).toBeGreaterThanOrEqual(viewport[2]);
        expect(rendered[3]).toBeLessThanOrEqual(viewport[3]);
      }
      const combinedBase: [number, number, number, number] = [
        Math.min(...baseBounds.map(([left]) => left)),
        Math.max(...baseBounds.map(([, right]) => right)),
        Math.min(...baseBounds.map(([, , top]) => top)),
        Math.max(...baseBounds.map(([, , , bottom]) => bottom)),
      ];
      const contextBounds = layer.contextFeatureIds.map((id) =>
        bounds(
          map.features[id as keyof typeof map.features].paths,
          ([x, y]) => [
            x +
              Math.round((viewportCenterX - x) / layer.wrapWidth) *
                layer.wrapWidth,
            projectRendered([x, y])[1],
          ],
        ),
      );
      expect(
        contextBounds.some((context) => intersects(context, combinedBase)),
      ).toBe(true);
    }
  });

  it('supports a second mapped quiz through a data-shaped config only', () => {
    const synthetic = {
      id: 'synthetic-mapped',
      name: 'Synthetic mapped quiz',
      description: 'Synthetic mapped quiz',
      menuLabel: 'Synthetic mapped quiz',
      thumbnailViewBox: '1 2 3 4',
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
    } satisfies (typeof quizOptions)[number];
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
      .filter(({ category }) => category === undefined)
      .filter(({ id }) => id !== 'world' && id !== 'non-un')
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
