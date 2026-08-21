import locations from '../data/generated/locations.json';

export type RenderLocation = {
  id: string;
  name: string;
  geometryRefs: string[];
  anchor: number[];
  bounds: number[];
};

export function mapLocationForQuizId(id: string): RenderLocation | undefined {
  return locations.find((location) => location.id === id);
}
