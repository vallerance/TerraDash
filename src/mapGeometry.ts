import map from '../data/generated/map.json';
import inset from '../data/generated/inset.json';
import {
  hasRenderableArea,
  pathArea,
  pathPoints,
  type Point,
} from './footprint';

export type InsetPathKind = 'polygon' | 'artifact' | 'degenerate';
export type InsetGeometryPath = {
  path: string;
  kind: InsetPathKind;
  polygonId: string;
  ringIds: string[];
  center: Point;
  span: Point;
  area: number;
};

export type TinyInsetDot = {
  center: Point;
  diameter: number;
};

function pathMetrics(path: string) {
  const points = pathPoints([path]);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const area = pathArea(path);
  if (Math.abs(area) <= Number.EPSILON)
    return {
      center: [(minX + maxX) / 2, (minY + maxY) / 2] as Point,
      span: [maxX - minX, maxY - minY] as Point,
    };
  const center = points.reduce(
    (result, point, index) => {
      const next = points[(index + 1) % points.length];
      const cross = point[0] * next[1] - next[0] * point[1];
      result[0] += (point[0] + next[0]) * cross;
      result[1] += (point[1] + next[1]) * cross;
      return result;
    },
    [0, 0] as Point,
  );
  return {
    center: [center[0] / (6 * area), center[1] / (6 * area)] as Point,
    span: [maxX - minX, maxY - minY] as Point,
  };
}

export function tinyInsetDot(
  paths: InsetGeometryPath[],
  renderedScale: number,
  threshold = 2,
): TinyInsetDot | undefined {
  const regions = paths.filter(({ kind }) => kind === 'polygon');
  if (!regions.length || renderedScale <= 0) return undefined;
  const largest = regions.reduce((best, region) =>
    region.area > best.area ? region : best,
  );
  return Math.min(...largest.span) * renderedScale < threshold
    ? { center: largest.center, diameter: threshold }
    : undefined;
}

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
  if (!refs?.length) return [];
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
      const exteriorPath =
        validRings.find((ring) => ring.role === 'exterior')?.path ?? path;
      const metrics = pathMetrics(exteriorPath);
      return {
        path,
        kind: invalidRings.length
          ? ('artifact' as const)
          : validRings.length
            ? ('polygon' as const)
            : ('degenerate' as const),
        polygonId: polygon.id,
        ringIds: polygon.rings.map((ring) => ring.id),
        ...metrics,
        area: Math.abs(pathArea(exteriorPath)),
      };
    });
  });
}
