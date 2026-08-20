import catalogData from '../data/generated/catalog.json';
import quizData from '../data/generated/quiz.json';
import quizzesData from '../data/quizzes.json';
import candidateData from '../data/generated/non-un-candidates.json';
import type { CatalogLocation, QuizDefinition } from './quizEngine';

export const defaultCatalog: CatalogLocation[] = [
  ...catalogData.map(({ id, name }) => ({
    id,
    name,
  })),
  ...candidateData.map(({ id, name }) => ({ id, name })),
];

export const defaultQuiz: QuizDefinition = {
  id: quizData.id,
  locationIds: [...quizData.locationIds],
};

export type QuizOption = QuizDefinition & {
  name: string;
  description?: string;
};

const catalogByIso3 = new Map(
  catalogData.map((location) => [location.iso3, location]),
);
export const quizOptions: QuizOption[] = quizzesData.map((quiz) => ({
  id: quiz.id,
  name: quiz.name,
  description: quiz.description,
  locationIds:
    quiz.candidateSet === 'non-un'
      ? candidateData.map(({ id }) => id)
      : ((quiz as { locationIds?: string[] }).locationIds ??
        quiz.locationIso3?.map((iso3) => {
          const location = catalogByIso3.get(iso3);
          if (!location)
            throw new Error(`Quiz location is absent from catalog: ${iso3}`);
          return location.id;
        }) ??
        []),
}));

export const worldQuiz = quizOptions[0];
