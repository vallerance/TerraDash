import type { CatalogLocation } from './quizEngine';

export const SUGGESTION_LIMIT = 8;

export function suggestionsFor(
  catalog: readonly CatalogLocation[],
  query: string,
  limit = SUGGESTION_LIMIT,
): CatalogLocation[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return catalog.slice(0, limit);
  const matches = catalog.filter((location) =>
    location.name.toLowerCase().includes(normalized),
  );
  matches.sort((left, right) => {
    const leftExact = left.name.toLowerCase() === normalized ? 0 : 1;
    const rightExact = right.name.toLowerCase() === normalized ? 0 : 1;
    return leftExact - rightExact || left.name.localeCompare(right.name, 'en');
  });
  const visible = matches.slice(0, limit);
  const exact = matches.find(
    (location) => location.name.toLowerCase() === normalized,
  );
  if (exact && !visible.includes(exact)) {
    visible[visible.length - 1] = exact;
  }
  return visible;
}
