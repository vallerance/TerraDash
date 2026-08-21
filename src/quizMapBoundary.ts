import catalog from '../data/generated/catalog.json';
import candidates from '../data/generated/non-un-candidates.json';

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
    candidates.find((location) => location.id === id);
  return location;
}
