import map from '../data/generated/map.json';
import inset from '../data/generated/inset.json';
import { hasRenderableArea } from './footprint';

export type InsetPathKind = 'polygon' | 'artifact' | 'degenerate';
export type InsetGeometryPath = { path: string; kind: InsetPathKind };

export function baseGeometryPaths(): string[] {
  return map.sourceFeatureIds.flatMap(
    (id) => map.features[id as keyof typeof map.features].paths,
  );
}

export function highlightedGeometryPaths(refs: string[]): string[] {
  return refs.flatMap(
    (id) => map.features[id as keyof typeof map.features].paths,
  );
}

export function insetGeometryPaths(locationId: string): string[] {
  return classifyInsetGeometryPaths(locationId).map(({ path }) => path);
}

export function classifyInsetGeometryPaths(
  locationId: string,
): InsetGeometryPath[] {
  const refs =
    inset.locationFeatureIds[
      locationId as keyof typeof inset.locationFeatureIds
    ];
  if (!refs?.length)
    throw new Error(`Missing inset geometry for ${locationId}`);
  return refs.flatMap((id) =>
    inset.features[id as keyof typeof inset.features].paths.map(
      (path, pathIndex) => ({
        path,
        kind: !hasRenderableArea(path)
          ? ('degenerate' as const)
          : isKnownArtifact(locationId, pathIndex)
            ? ('artifact' as const)
            : ('polygon' as const),
      }),
    ),
  );
}

// The pinned 1:10m artifact contains one reviewed malformed micro-ring in
// ATG. Keep this identity explicit: valid polygons still fill, while this
// known artifact is never painted. This is data classification, not CSS or
// a projected-size heuristic.
const KNOWN_INVALID_PATHS: Record<string, number[]> = { 'iso:ATG': [1] };
function isKnownArtifact(locationId: string, pathIndex: number): boolean {
  return KNOWN_INVALID_PATHS[locationId]?.includes(pathIndex) ?? false;
}
