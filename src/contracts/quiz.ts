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
export type QuizCategoryId =
  'global' | 'world' | 'regional' | 'islands' | (string & {});
export type QuizCategory = {
  id: QuizCategoryId;
  label: string;
  order: number;
  options: QuizOption[];
};

const quizCategoryDefinitions: readonly Omit<QuizCategory, 'options'>[] = [
  { id: 'global', label: 'Countries', order: 0 },
  { id: 'world', label: 'World', order: 1 },
  { id: 'regional', label: 'States and Provinces', order: 2 },
  { id: 'islands', label: 'Islands', order: 3 },
];

export type QuizOption = QuizDefinition & {
  name: string;
  description: string;
  menuLabel: string;
  thumbnailViewBox: string;
  category?: QuizCategoryId;
  map?: QuizMapInput;
};

type QuizInput = {
  id: string;
  name: string;
  description: string;
  menuLabel: string;
  thumbnailViewBox: string;
  category?: QuizCategoryId;
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

export function quizCategoriesFor(
  options: readonly QuizOption[],
): QuizCategory[] {
  const grouped = new Map<string, QuizOption[]>();
  for (const quiz of options) {
    const categoryId = quiz.category ?? 'global';
    grouped.set(categoryId, [...(grouped.get(categoryId) ?? []), quiz]);
  }
  const definitions = new Map(
    quizCategoryDefinitions.map((definition) => [definition.id, definition]),
  );
  const nextOrder =
    Math.max(-1, ...quizCategoryDefinitions.map(({ order }) => order)) + 1;
  for (const [index, id] of [...grouped.keys()].entries()) {
    if (!definitions.has(id))
      definitions.set(id, {
        id,
        label: `${id.charAt(0).toUpperCase()}${id.slice(1)} quizzes`,
        order: nextOrder + index,
      });
  }
  return [...grouped.entries()]
    .map(([id, groupedOptions]) => ({
      ...definitions.get(id)!,
      options: groupedOptions,
    }))
    .sort((first, second) => first.order - second.order);
}

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
