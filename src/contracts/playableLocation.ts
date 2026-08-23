import {
  generatedLocationForId,
  generatedLocations,
  type GeneratedLocation,
} from './generatedData';

export type PlayableLocation = GeneratedLocation;

export const playableLocations = generatedLocations;
export const playableLocationsById = new Map(
  playableLocations.map((location) => [location.id, location]),
);

export function playableLocationForId(
  id: string,
): PlayableLocation | undefined {
  return generatedLocationForId(id);
}

export function locationsForIds(ids: readonly string[]): PlayableLocation[] {
  return ids
    .map((id) => playableLocationsById.get(id))
    .filter((location): location is PlayableLocation => Boolean(location));
}
