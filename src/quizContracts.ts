import catalogData from '../data/generated/catalog.json';
import quizData from '../data/generated/quiz.json';
import quizzesData from '../data/quizzes.json';
import candidateData from '../data/generated/non-un-candidates.json';
import type { CatalogLocation, QuizDefinition } from './quizEngine';

export const defaultCatalog: CatalogLocation[] = catalogData.map(
  ({ id, name }) => ({
    id,
    name,
  }),
);

export const candidateCatalog: CatalogLocation[] = candidateData.map(
  ({ id, name }) => ({
    id,
    name,
  }),
);

export const allCatalog: CatalogLocation[] = [
  ...defaultCatalog,
  ...candidateCatalog,
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
type QuizInput = {
  id: string;
  name: string;
  description?: string;
} & (
  | { candidateSet: 'non-un'; locationIso3?: never; locationIds?: never }
  | { locationIds: string[]; candidateSet?: never; locationIso3?: never }
  | { locationIso3: string[]; candidateSet?: never; locationIds?: never }
);

export const quizOptions: QuizOption[] = (quizzesData as QuizInput[]).map(
  (quiz): QuizOption => {
    const locationIds =
      quiz.candidateSet === 'non-un'
        ? candidateData.map(({ id }) => id)
        : 'locationIds' in quiz
          ? (quiz.locationIds ?? [])
          : quiz.locationIso3.map((iso3) => {
              const location = catalogByIso3.get(iso3);
              if (!location)
                throw new Error(
                  `Quiz location is absent from catalog: ${iso3}`,
                );
              return location.id;
            });
    return {
      id: quiz.id,
      name: quiz.name,
      description: quiz.description,
      locationIds,
    };
  },
);

export const worldQuiz = quizOptions[0];
