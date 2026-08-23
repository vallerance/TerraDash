import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import reviewed from '../data/reviewed-invariants.json';
import {
  configuredQuizzes,
  generatedInset,
  generatedLocations,
  generatedManifest,
  generatedMap,
} from './contracts/generatedData';
import {
  locationsForQuiz,
  playableLocationsById,
  quizOptions,
} from './contracts/quiz';

const sourceRoot = dirname(fileURLToPath(import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')
      ? [path]
      : [];
  });
}

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
    const readers = sourceFiles(sourceRoot).filter(
      (path) =>
        !path.endsWith('contracts/generatedData.ts') &&
        !path.endsWith('.test.ts') &&
        !path.endsWith('.test.tsx'),
    );
    const forbiddenRawImports = readers.flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return /data\/generated\/(locations|map|inset|manifest)\.json|data\/quizzes\.json/.test(
        source,
      )
        ? [path]
        : [];
    });
    expect(forbiddenRawImports).toEqual([]);

    const contractFiles = sourceFiles(join(sourceRoot, 'contracts'));
    for (const path of contractFiles) {
      const source = readFileSync(path, 'utf8');
      expect(source).not.toMatch(/from ['"][^'"]*\.tsx?['"]|from ['"]react/);
    }
  });
});
