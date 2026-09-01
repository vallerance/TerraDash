import insetData from '../../data/generated/inset.json';
import locationsData from '../../data/generated/locations.json';
import manifestData from '../../data/generated/manifest.json';
import mapData from '../../data/generated/map.json';
import contextData from '../../data/generated/context.json';
import quizzesData from '../../data/quizzes.json';
import type { LocationKind } from '../map/locationSemantics';

export const generatedInset = insetData;
export const generatedLocations =
  locationsData as readonly ((typeof locationsData)[number] & {
    kind: LocationKind;
  })[];
export const generatedManifest = manifestData;
export const generatedMap = mapData;
export const generatedContext = contextData as GeneratedContext;
export const configuredQuizzes = quizzesData;

export type GeneratedLocation = (typeof generatedLocations)[number];
export type GeneratedMap = typeof generatedMap;
export type GeneratedContext = {
  generatedAt: string;
  variants: readonly {
    source: string;
    tolerance: number;
    featureIds: readonly string[];
    features: Record<
      string,
      { paths: string[]; anchor: number[]; bounds: number[] }
    >;
  }[];
};
export type GeneratedInset = typeof generatedInset;
export type GeneratedManifest = typeof generatedManifest;
export type ConfiguredQuiz = (typeof configuredQuizzes)[number];

export const generatedLocationsById = new Map(
  generatedLocations.map((location) => [location.id, location]),
);

export function generatedLocationForId(
  id: string,
): GeneratedLocation | undefined {
  return generatedLocationsById.get(id);
}
