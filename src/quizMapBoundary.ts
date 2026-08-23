import {
  playableLocationForId,
  type PlayableLocation,
} from './contracts/playableLocation';

export type RenderLocation = PlayableLocation;

export function mapLocationForQuizId(id: string): RenderLocation | undefined {
  return playableLocationForId(id);
}
