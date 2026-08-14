import type { CatalogLocation } from './quizEngine';
import { countryNameKey } from './countryName';

export const SUGGESTION_LIMIT = 8;

export function suggestionsFor(
  catalog: readonly CatalogLocation[],
  query: string,
  limit = SUGGESTION_LIMIT,
): CatalogLocation[] {
  const normalized = countryNameKey(query);
  if (!normalized) return catalog.slice(0, limit);
  const matches = catalog.filter((location) =>
    countryNameKey(location.name).includes(normalized),
  );
  matches.sort((left, right) => {
    const leftExact = countryNameKey(left.name) === normalized ? 0 : 1;
    const rightExact = countryNameKey(right.name) === normalized ? 0 : 1;
    return leftExact - rightExact || left.name.localeCompare(right.name, 'en');
  });
  const visible = matches.slice(0, limit);
  const exact = matches.find(
    (location) => countryNameKey(location.name) === normalized,
  );
  if (exact && !visible.includes(exact)) {
    visible[visible.length - 1] = exact;
  }
  return visible;
}
