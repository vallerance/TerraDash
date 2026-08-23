import type { CatalogLocation, QuizDefinition } from '../quizEngine';
import { highlightedGeometryPaths } from '../mapGeometry';
import { configuredQuizzes, generatedMap } from './generatedData';
import {
  locationsForIds,
  playableLocations,
  playableLocationsById,
} from './playableLocation';

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
};

export type QuizOption = QuizDefinition & {
  name: string;
  description?: string;
  category?: 'regional';
  map?: QuizMapInput;
};

export type MapLayer = {
  contextFeatureIds: readonly string[];
  baseLayers: readonly { id: string; paths: string[] }[];
  activePaths: string[];
  wrapActive: boolean;
  viewBox: string;
  preserveAspectRatio?: string;
  standardParallel: number;
  wrapWidth: number;
  seamLongitude: number;
  selectable: boolean;
};

type QuizInput = {
  id: string;
  name: string;
  description?: string;
  category?: 'regional';
  locationIds: string[];
  map?: QuizMapInput;
};

const configuredQuizOptions = configuredQuizzes as readonly QuizInput[];

export const quizOptions: QuizOption[] = configuredQuizOptions.map((quiz) => ({
  id: quiz.id,
  name: quiz.name,
  description: quiz.description,
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

const defaultMap: MapLayer = {
  contextFeatureIds: generatedMap.sourceFeatureIds,
  baseLayers: [],
  activePaths: [],
  wrapActive: true,
  viewBox: '',
  standardParallel: 0,
  wrapWidth: 1440,
  seamLongitude: 152,
  selectable: false,
};

export function mapLayerForQuiz(
  quiz: QuizOption,
  active: { geometryRefs: string[] },
): MapLayer {
  const config = quiz.map;
  const exclusions = new Set(config?.contextFeatureExclusions ?? []);
  return {
    contextFeatureIds: generatedMap.sourceFeatureIds.filter(
      (id) => !exclusions.has(id),
    ),
    baseLayers: (config?.baseLayerLocationIds ?? [])
      .map((id) => playableLocationsById.get(id))
      .filter((location): location is (typeof playableLocations)[number] =>
        Boolean(location),
      )
      .map((location) => ({
        id: location.id,
        paths: highlightedGeometryPaths(location.geometryRefs),
      })),
    activePaths: highlightedGeometryPaths(active.geometryRefs),
    wrapActive: config?.wrapActive ?? defaultMap.wrapActive,
    viewBox: config?.viewBox ?? defaultMap.viewBox,
    preserveAspectRatio: config?.preserveAspectRatio,
    standardParallel: config?.standardParallel ?? defaultMap.standardParallel,
    wrapWidth: config?.wrapWidth ?? defaultMap.wrapWidth,
    seamLongitude: config?.seamLongitude ?? defaultMap.seamLongitude,
    selectable: config?.selectable ?? defaultMap.selectable,
  };
}

export function mapLayerForLocation(active: {
  id: string;
  geometryRefs: string[];
}): MapLayer {
  const quiz = quizOptions.find((candidate) =>
    candidate.locationIds.includes(active.id),
  );
  return mapLayerForQuiz(quiz ?? worldQuiz, active);
}
