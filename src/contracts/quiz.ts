import { configuredQuizzes } from './generatedData';
import {
  locationsForIds,
  playableLocations,
  playableLocationsById,
} from './playableLocation';

export { playableLocations, playableLocationsById } from './playableLocation';

export type QuizMapInput = {
  contextFeatureExclusions?: string[];
  baseLayerLocationIds?: string[];
  viewBox?: string;
  preserveAspectRatio?: string;
  standardParallel?: number;
  wrapWidth?: number;
  seamLongitude?: number;
  wrapActive?: boolean;
  selectable?: boolean;
  regionalDetail?: {
    mainTolerance: number;
    context?: {
      source: 'admin0-10m';
      tolerance: number;
    };
  };
};

export type CatalogLocation = { id: string; name: string };
export type QuizDefinition = { id: string; locationIds: string[] };

export type QuizOption = QuizDefinition & {
  name: string;
  description: string;
  menuLabel: string;
  thumbnailViewBox: string;
  category?: 'world' | 'regional';
  map?: QuizMapInput;
};

type QuizInput = {
  id: string;
  name: string;
  description: string;
  menuLabel: string;
  thumbnailViewBox: string;
  category?: 'world' | 'regional';
  locationIds: string[];
  map?: QuizMapInput;
};

const configuredQuizOptions = configuredQuizzes as readonly QuizInput[];

export const quizOptions: QuizOption[] = configuredQuizOptions.map((quiz) => ({
  id: quiz.id,
  name: quiz.name,
  description: quiz.description,
  menuLabel: quiz.menuLabel,
  thumbnailViewBox: quiz.thumbnailViewBox,
  category: quiz.category,
  map: quiz.map,
  locationIds: [...quiz.locationIds],
}));

export const worldQuiz = quizOptions.find(({ id }) => id === 'world')!;
export const defaultQuiz: QuizDefinition = {
  id: worldQuiz.id,
  locationIds: [...worldQuiz.locationIds],
};
export const defaultCatalog: CatalogLocation[] = locationsForIds(
  defaultQuiz.locationIds,
).map(({ id, name }) => ({ id, name }));

export function locationsForQuiz(quiz: Pick<QuizDefinition, 'locationIds'>) {
  return locationsForIds(quiz.locationIds);
}
