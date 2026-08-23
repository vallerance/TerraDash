import { describe, expect, it } from 'vitest';
import reviewed from '../data/reviewed-invariants.json';
import {
  configuredQuizzes,
  generatedInset,
  generatedLocations,
  generatedManifest,
  generatedMap,
} from './contracts/generatedData';
import { locationsForQuiz, quizOptions } from './contracts/quiz';
import { playableLocationsById } from './contracts/playableLocation';

const sourceModules = import.meta.glob('./**/*.{ts,tsx}', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

describe('typed runtime data boundary', () => {
  it('preserves the reviewed location and membership sets', () => {
    expect(new Set(generatedLocations.map(({ id }) => id))).toEqual(
      new Set(reviewed.locationIds),
    );

    for (const reviewedQuiz of Object.keys(reviewed.quizMemberships)) {
      const quiz = quizOptions.find(({ id }) => id === reviewedQuiz);
      expect(quiz).toBeDefined();
      expect(new Set(quiz!.locationIds)).toEqual(
        new Set(
          reviewed.quizMemberships[
            reviewedQuiz as keyof typeof reviewed.quizMemberships
          ],
        ),
      );
      expect(locationsForQuiz(quiz!)).toHaveLength(quiz!.locationIds.length);
    }
  });

  it('resolves every configured member and geometry reference through the adapter', () => {
    const reviewedIds = new Set(reviewed.locationIds);
    const mainLocationIds = Object.keys(generatedMap.locationFeatureIds);
    const insetLocationIds = Object.keys(generatedInset.locationFeatureIds);
    expect(new Set(mainLocationIds)).toEqual(reviewedIds);
    expect(new Set(insetLocationIds)).toEqual(reviewedIds);

    for (const id of reviewed.locationIds) {
      const mainRefs =
        generatedMap.locationFeatureIds[
          id as keyof typeof generatedMap.locationFeatureIds
        ];
      const insetRefs =
        generatedInset.locationFeatureIds[
          id as keyof typeof generatedInset.locationFeatureIds
        ];
      expect(mainRefs, `${id} main index`).toBeDefined();
      expect(insetRefs, `${id} inset index`).toBeDefined();
      for (const ref of mainRefs!) {
        expect(
          generatedMap.features[ref as keyof typeof generatedMap.features],
          `${id} main ${ref}`,
        ).toBeDefined();
      }
      for (const ref of insetRefs!) {
        expect(
          generatedInset.features[ref as keyof typeof generatedInset.features],
          `${id} inset ${ref}`,
        ).toBeDefined();
      }
      expect(
        generatedManifest.locations[
          id as keyof typeof generatedManifest.locations
        ],
      ).toEqual(mainRefs);
    }

    expect(new Set(generatedManifest.featureIds)).toEqual(
      new Set(Object.keys(generatedMap.features)),
    );
    expect(new Set(generatedManifest.inset.featureIds)).toEqual(
      new Set(generatedInset.sourceFeatureIds),
    );
    for (const replacement of generatedManifest.geometrySourceReplacements) {
      expect(
        generatedMap.features[
          replacement.canonicalFeatureId as keyof typeof generatedMap.features
        ],
      ).toBeDefined();
      expect(
        generatedManifest.supplementalSources.some(
          ({ id }) => id === replacement.source,
        ),
      ).toBe(true);
    }

    for (const quiz of configuredQuizzes) {
      for (const id of quiz.locationIds) {
        const location = playableLocationsById.get(id);
        expect(location, `${quiz.id} -> ${id}`).toBeDefined();
        for (const ref of location!.geometryRefs) {
          expect(
            generatedMap.features[ref as keyof typeof generatedMap.features],
          ).toBeDefined();
        }
      }
    }
    expect(generatedInset.locationFeatureIds).toBeDefined();
    expect(generatedManifest).toBeDefined();
  });

  it('keeps raw data readers and UI dependencies behind the contract boundary', () => {
    const readers = Object.entries(sourceModules).filter(
      ([path]) =>
        !path.endsWith('contracts/generatedData.ts') &&
        !path.endsWith('.test.ts') &&
        !path.endsWith('.test.tsx'),
    );
    const forbiddenRawImports = readers.flatMap(([path, source]) => {
      return /data\/generated\/(locations|map|inset|manifest)\.json|data\/quizzes\.json/.test(
        source,
      )
        ? [path]
        : [];
    });
    expect(forbiddenRawImports).toEqual([]);

    for (const [path, source] of Object.entries(sourceModules).filter(
      ([path]) => path.startsWith('./contracts/'),
    )) {
      expect(source).not.toMatch(/from ['"](?:\.\.\/|[^.][^'"/]*)/);
      expect(source).not.toMatch(/from ['"]react/);
    }
  });
});
