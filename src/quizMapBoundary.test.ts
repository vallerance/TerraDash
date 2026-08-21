import { describe, expect, it } from 'vitest';
import {
  mapLocationForQuizId,
  mapViewBoxForQuiz,
  US_STATES_VIEW_BOX,
} from './quizMapBoundary';

describe('US States regional map contract', () => {
  it('uses one continuous true-position viewport for the regional quiz', () => {
    expect(mapViewBoxForQuiz('us-states', 'US-AK')).toBe(US_STATES_VIEW_BOX);
    expect(mapViewBoxForQuiz('us-states', 'US-HI')).toBe(US_STATES_VIEW_BOX);
    expect(US_STATES_VIEW_BOX).toBe('10 35 500 295');
  });

  it('resolves state IDs through generated exact geometry', () => {
    expect(mapLocationForQuizId('US-AK')?.geometryRefs).toEqual([
      'ne:admin1:1159308731',
    ]);
    expect(mapLocationForQuizId('US-HI')?.geometryRefs).toEqual([
      'ne:admin1:1159308409',
    ]);
  });
});
