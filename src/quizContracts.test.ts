import { describe, expect, it } from 'vitest';
import { defaultCatalog, defaultQuiz, quizOptions } from './quizContracts';

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

describe('regional quiz partition', () => {
  it('defines exactly the eight requested UN Countries quizzes', () => {
    expect(quizOptions.map(({ name }) => name)).toEqual([
      'World UN Countries',
      'Africa UN Countries',
      'Asia UN Countries',
      'Europe UN Countries',
      'North America UN Countries',
      'South America UN Countries',
      'Oceania UN Countries',
      'Caribbean UN Countries',
    ]);
    expect(quizOptions).toHaveLength(8);
    expect(quizOptions.every(({ name }) => name.includes('UN Countries'))).toBe(
      true,
    );
  });

  it('partitions the existing world dataset exactly once regionally', () => {
    const worldIds = new Set(quizOptions[0].locationIds);
    const regionalIds = quizOptions
      .slice(1)
      .flatMap(({ locationIds }) => locationIds);
    expect(worldIds).toEqual(new Set(defaultCatalog.map(({ id }) => id)));
    expect(regionalIds).toHaveLength(worldIds.size);
    expect(new Set(regionalIds).size).toBe(worldIds.size);
    expect(regionalIds.every((id) => worldIds.has(id))).toBe(true);
  });
});
