import map from '../data/generated/map.json';
import inset from '../data/generated/inset.json';
import { hasRenderableArea } from './footprint';

export type InsetPathKind = 'polygon' | 'degenerate';
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
    inset.features[id as keyof typeof inset.features].paths.map((path) => ({
      path,
      kind: hasRenderableArea(path)
        ? ('polygon' as const)
        : ('degenerate' as const),
    })),
  );
}
