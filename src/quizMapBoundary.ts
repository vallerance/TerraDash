import catalog from '../data/generated/catalog.json';
import candidates from '../data/generated/non-un-candidates.json';
import usStates from '../data/generated/us-states.json';

export const US_STATES_VIEW_BOX = '10 35 500 295';

export function isUsStatesLocation(id: string): boolean {
  return /^US-[A-Z]{2}$/.test(id);
}

export function mapViewBoxForQuiz(
  quizId: string | undefined,
  locationId: string,
): string | undefined {
  return quizId === 'us-states' || isUsStatesLocation(locationId)
    ? US_STATES_VIEW_BOX
    : undefined;
}

export type RenderLocation = {
  id: string;
  name: string;
  geometryRefs: string[];
  anchor: number[];
  bounds: number[];
};

export function mapLocationForQuizId(id: string): RenderLocation | undefined {
  const location =
    catalog.find((location) => location.id === id) ??
    candidates.find((location) => location.id === id) ??
    usStates.find((location) => location.id === id);
  return location;
}
