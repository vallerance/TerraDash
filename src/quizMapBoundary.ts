import {
  playableLocationForId,
  playableLocations,
  playableLocationsById,
  type PlayableLocation,
} from './contracts/playableLocation';
import { quizOptions, worldQuiz, type QuizOption } from './contracts/quiz';
import { generatedMap } from './contracts/generatedData';
import { highlightedGeometryPaths } from './mapGeometry';

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

export type RenderLocation = PlayableLocation;

export function mapLocationForQuizId(id: string): RenderLocation | undefined {
  return playableLocationForId(id);
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
