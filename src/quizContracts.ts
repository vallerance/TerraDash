import locationsData from '../data/generated/locations.json';
import quizData from '../data/generated/quiz.json';
import quizzesData from '../data/quizzes.json';
import type { CatalogLocation, QuizDefinition } from './quizEngine';
import map from '../data/generated/map.json';
import { highlightedGeometryPaths } from './mapGeometry';

export const playableLocations = locationsData;

export const defaultQuiz: QuizDefinition = {
  id: quizData.id,
  locationIds: [...quizData.locationIds],
};
export const defaultCatalog: CatalogLocation[] = defaultQuiz.locationIds.map(
  (id) => {
    const location = playableLocations.find(
      (candidate) => candidate.id === id,
    )!;
    return { id: location.id, name: location.name };
  },
);

export type QuizOption = QuizDefinition & {
  name: string;
  description?: string;
  category?: 'regional';
  map?: QuizMapInput;
};

export type QuizMapInput = {
  contextFeatureExclusions?: string[];
  baseLayerLocationIds?: string[];
  viewBox?: string;
  wrapActive?: boolean;
  selectable?: boolean;
};
export type MapLayer = {
  contextFeatureIds: readonly string[];
  baseLayers: readonly { id: string; paths: string[] }[];
  activePaths: string[];
  wrapActive: boolean;
  viewBox: string;
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

export const quizOptions: QuizOption[] = (quizzesData as QuizInput[]).map(
  (quiz): QuizOption => {
    return {
      id: quiz.id,
      name: quiz.name,
      description: quiz.description,
      category: quiz.category,
      map: quiz.map,
      locationIds: quiz.locationIds,
    };
  },
);

const defaultMap: MapLayer = {
  contextFeatureIds: map.sourceFeatureIds,
  baseLayers: [],
  activePaths: [],
  wrapActive: true,
  viewBox: '',
  selectable: false,
};
const locationsById = new Map(
  playableLocations.map((location) => [location.id, location]),
);
export function mapLayerForQuiz(
  quiz: QuizOption,
  active: { geometryRefs: string[] },
): MapLayer {
  const config = quiz.map;
  const exclusions = new Set(config?.contextFeatureExclusions ?? []);
  return {
    contextFeatureIds: map.sourceFeatureIds.filter((id) => !exclusions.has(id)),
    baseLayers: (config?.baseLayerLocationIds ?? [])
      .map((id) => locationsById.get(id))
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

export const worldQuiz = quizOptions[0];
