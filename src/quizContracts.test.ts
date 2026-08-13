import { describe, expect, it } from 'vitest';
import { defaultCatalog, defaultQuiz } from './quizContracts';

describe('generated quiz wiring', () => {
  it('exposes the complete generated 195-location contract', () => {
    expect(defaultCatalog).toHaveLength(195);
    expect(defaultQuiz.locationIds).toHaveLength(195);
    expect(new Set(defaultQuiz.locationIds).size).toBe(195);
    expect(
      defaultQuiz.locationIds.every((id) =>
        defaultCatalog.some((item) => item.id === id),
      ),
    ).toBe(true);
  });
});
