import insetData from '../../data/generated/inset.json';
import locationsData from '../../data/generated/locations.json';
import manifestData from '../../data/generated/manifest.json';
import mapData from '../../data/generated/map.json';
import quizzesData from '../../data/quizzes.json';

export const generatedInset = insetData;
export const generatedLocations = locationsData;
export const generatedManifest = manifestData;
export const generatedMap = mapData;
export const configuredQuizzes = quizzesData;

export type GeneratedLocation = (typeof generatedLocations)[number];
export type GeneratedMap = typeof generatedMap;
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
