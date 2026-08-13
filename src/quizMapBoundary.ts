import catalog from '../data/generated/catalog.json';

export type RenderLocation = (typeof catalog)[number];

export function mapLocationForQuizId(id: string): RenderLocation | undefined {
  return catalog.find((location) => location.id === id);
}
