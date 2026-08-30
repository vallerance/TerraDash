import { describe, expect, it } from 'vitest';
import { generatedMap } from './contracts/generatedData';
import { locationsForQuiz, quizOptions } from './contracts/quiz';

const expected = [
  ['world:africa', 'Africa'],
  ['world:antarctica', 'Antarctica'],
  ['world:asia', 'Asia'],
  ['world:europe', 'Europe'],
  ['world:north-america', 'North America'],
  ['world:south-america', 'South America'],
  ['world:australia', 'Australia'],
  ['world:arctic-ocean', 'Arctic Ocean'],
  ['world:atlantic-ocean', 'Atlantic Ocean'],
  ['world:indian-ocean', 'Indian Ocean'],
  ['world:pacific-ocean', 'Pacific Ocean'],
  ['world:southern-ocean', 'Southern Ocean'],
] as const;

describe('Continents and Oceans world quiz', () => {
  it('exposes exactly the requested stable locations and category', () => {
    const quiz = quizOptions.find(({ id }) => id === 'continents-and-oceans');
    expect(quiz?.name).toBe('Continents and Oceans');
    expect(quiz?.category).toBe('world');
    expect(quiz?.locationIds).toEqual(expected.map(([id]) => id));
    expect(new Set(quiz?.locationIds).size).toBe(expected.length);
    expect(locationsForQuiz(quiz!)).toEqual(
      expected.map(([id, name]) => expect.objectContaining({ id, name })),
    );
  });

  it('has non-empty projected geometry for every target, including polar/seam oceans', () => {
    const quiz = quizOptions.find(({ id }) => id === 'continents-and-oceans')!;
    for (const [id] of expected) {
      const refs = generatedMap.locationFeatureIds[
        id as keyof typeof generatedMap.locationFeatureIds
      ];
      expect(refs?.length, `${id} refs`).toBeGreaterThan(0);
      for (const ref of refs) {
        const feature = generatedMap.features[
          ref as keyof typeof generatedMap.features
        ];
        expect(feature?.paths.length, `${id} ${ref} paths`).toBeGreaterThan(0);
        expect(
          feature?.bounds.every(Number.isFinite),
          `${id} ${ref} bounds`,
        ).toBe(true);
      }
    }
    expect(quiz.locationIds).toHaveLength(12);
  });
});
