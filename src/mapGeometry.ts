import map from '../data/generated/map.json';
import inset from '../data/generated/inset.json';
import { hasRenderableArea } from './footprint';

export type InsetPathKind = 'polygon' | 'artifact' | 'degenerate';
export type InsetGeometryPath = {
  path: string;
  kind: InsetPathKind;
  polygonId: string;
  ringIds: string[];
};

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
  return refs.flatMap((id) => {
    const feature = inset.features[id as keyof typeof inset.features];
    return feature.polygons.map((polygon) => {
      const validRings = polygon.rings.filter(
        (ring) => ring.valid && hasRenderableArea(ring.path),
      );
      const invalidRings = polygon.rings.filter((ring) => !ring.valid);
      const path = validRings.length
        ? validRings.map((ring) => ring.path).join('')
        : polygon.path;
      return {
        path,
        kind: invalidRings.length
          ? ('artifact' as const)
          : validRings.length
            ? ('polygon' as const)
            : ('degenerate' as const),
        polygonId: polygon.id,
        ringIds: polygon.rings.map((ring) => ring.id),
      };
    });
  });
}
