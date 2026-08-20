import catalog from '../data/generated/catalog.json';
import candidates from '../data/generated/non-un-candidates.json';

export type RenderLocation = (typeof catalog)[number];

export function mapLocationForQuizId(id: string): RenderLocation | undefined {
  return (
    catalog.find((location) => location.id === id) ??
    candidates.find((location) => location.id === id)
  );
}
