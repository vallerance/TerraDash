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
  /** Explicit versioned contract ID; never derived from geometry payloads at render time. */
  geometryContractId: string;
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
  contextDetail?: {
    source: 'admin0-10m';
    tolerance: number;
  };
};

/** Stable semantic identity for geometry that is allowed to rebuild the canvas. */
export function mapLayerIdentity(layer: MapLayer): string {
  return layer.geometryContractId;
}

export type RenderLocation = PlayableLocation;

export function mapLocationForQuizId(id: string): RenderLocation | undefined {
  return playableLocationForId(id);
}

const defaultMap: MapLayer = {
  geometryContractId: 'map-geometry-v1:world',
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
  const geometryContractId = [
    'map-geometry-v1',
    quiz.id,
    config?.contextFeatureExclusions?.join(',') ?? '',
    config?.baseLayerLocationIds?.join(',') ?? '',
    config?.viewBox ?? '',
    config?.preserveAspectRatio ?? '',
    config?.standardParallel ?? '',
    config?.wrapWidth ?? defaultMap.wrapWidth,
    config?.seamLongitude ?? defaultMap.seamLongitude,
    config?.contextDetail?.source ?? '',
    config?.contextDetail?.tolerance ?? '',
  ].join(':');
  const exclusions = new Set(config?.contextFeatureExclusions ?? []);
  return {
    geometryContractId,
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
    contextDetail: config?.regionalDetail?.context,
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
