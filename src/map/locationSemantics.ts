export type LocationKind = 'land' | 'water';

/** Semantic kind carried from authored metadata through generated locations. */
export function locationKindFor(location: {
  kind: LocationKind;
}): LocationKind {
  return location.kind;
}
