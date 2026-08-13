import catalogData from '../data/generated/catalog.json';
import quizData from '../data/generated/quiz.json';
import type { CatalogLocation, QuizDefinition } from './quizEngine';

export const defaultCatalog: CatalogLocation[] = catalogData.map(
  ({ id, name }) => ({
    id,
    name,
  }),
);

export const defaultQuiz: QuizDefinition = {
  id: quizData.id,
  locationIds: [...quizData.locationIds],
};
