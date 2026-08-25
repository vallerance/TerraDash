import { describe, expect, it } from 'vitest';
import map from '../data/generated/map.json';
import { defaultQuiz } from './contracts/quiz';
import { mapLocationForQuizId } from './quizMapBoundary';

describe('quiz-to-map boundary', () => {
  it('resolves a generated engine ID to its exact active geometry refs', () => {
    const id = defaultQuiz.locationIds[0];
    const location = mapLocationForQuizId(id);
    expect(location?.id).toBe(id);
    expect(location?.geometryRefs.length).toBeGreaterThan(0);
    expect(location?.geometryRefs.every((ref) => ref in map.features)).toBe(
      true,
    );
  });
});
