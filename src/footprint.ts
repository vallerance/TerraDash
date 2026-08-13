export type Point = [number, number];
export type Footprint = {
  kind: 'polygon' | 'circle';
  points?: Point[];
  center: Point;
  radius: number;
};
export const MIN_FOOTPRINT_PX = 10;
export const COMPONENT_CLUSTER_PROXIMITY_PX = 24;
export const MAP_SEAM_LONGITUDE = -180;
export const MAP_OVERLAP_REFERENCE_UNITS = 100;
export function pathPoints(paths: string[]): Point[] {
  return paths.flatMap((path) =>
    [...path.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(([, x, y]) => [
      +x,
      +y,
    ]),
  );
}
export function unwrapComponent(points: Point[], width: number): Point[] {
  if (points.length < 2) return points;
  const xs = [...new Set(points.map(([x]) => x))].sort((a, b) => a - b);
  let largestGap = -1;
  let start = xs[0];
  for (let i = 0; i < xs.length; i++) {
    const next = i + 1 < xs.length ? xs[i + 1] : xs[0] + width;
    if (next - xs[i] > largestGap) {
      largestGap = next - xs[i];
      start = next % width;
    }
  }
  return points.map(([x, y]) => [x < start ? x + width : x, y]);
}
export function componentSpan(path: string, width: number): number {
  return Math.max(
    ...pathPointComponents(path, width).map((points) => {
      const xs = points.map(([x]) => x);
      const ys = points.map(([, y]) => y);
      const sorted = [...new Set(xs)].sort((a, b) => a - b);
      const largestGap = Math.max(
        ...sorted.map((x, index) => {
          const next = sorted[index + 1] ?? sorted[0] + width;
          return next - x;
        }),
      );
      return Math.max(width - largestGap, Math.max(...ys) - Math.min(...ys));
    }),
    0,
  );
}
export function pathPointComponents(path: string, width: number): Point[][] {
  const components: Point[][] = [[]];
  for (const point of pathPoints([path])) {
    const previous = components.at(-1)!.at(-1);
    if (previous && Math.abs(point[0] - previous[0]) > width / 2)
      components.push([]);
    components.at(-1)!.push(point);
  }
  return components.filter((points) => points.length > 0);
}
export function deriveComponentFootprints(
  paths: string[],
  scale: number,
  width: number,
  threshold = MIN_FOOTPRINT_PX,
  proximity = COMPONENT_CLUSTER_PROXIMITY_PX,
  seamX = 0,
): Footprint[] {
  const components = paths.flatMap((path) =>
    pathPointComponents(path, width).map((component, index) => {
      const points = unwrapComponent(component, width);
      const aligned = points.map(
        ([x, y]) => [(x - seamX) * scale, y * scale] as Point,
      );
      const xs = aligned.map(([x]) => x);
      const ys = aligned.map(([, y]) => y);
      const nativeRadius =
        Math.max(
          Math.max(...xs) - Math.min(...xs),
          Math.max(...ys) - Math.min(...ys),
        ) / 2;
      return {
        footprint: deriveFootprint(aligned, threshold),
        nativeRadius,
        index,
      };
    }),
  );
  const parent = components.map((_, index) => index);
  const find = (index: number): number =>
    parent[index] === index ? index : (parent[index] = find(parent[index]));
  const join = (left: number, right: number) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  };
  for (let left = 0; left < components.length; left++)
    for (let right = left + 1; right < components.length; right++)
      if (
        Math.hypot(
          components[left].footprint.center[0] -
            components[right].footprint.center[0],
          components[left].footprint.center[1] -
            components[right].footprint.center[1],
        ) <= proximity
      )
        join(left, right);
  const clusterMap = new Map<number, typeof components>();
  components.forEach((component, index) => {
    const root = find(index);
    clusterMap.set(root, [...(clusterMap.get(root) ?? []), component]);
  });
  const clusters = [...clusterMap.values()];
  return clusters.flatMap((cluster) => {
    const native = cluster.filter(
      ({ footprint }) => footprint.kind === 'polygon',
    );
    if (native.length) return native.map(({ footprint }) => footprint);
    return [
      cluster.reduce((largest, component) =>
        component.nativeRadius > largest.nativeRadius ? component : largest,
      ).footprint,
    ];
  });
}

export function mapXForLongitude(longitude: number, width: number): number {
  return ((longitude + 180) / 360) * width;
}

export function wrappedOffsets(
  minX: number,
  maxX: number,
  width: number,
  seamX: number,
  overlap = MAP_OVERLAP_REFERENCE_UNITS,
): number[] {
  const alignedMin = minX - seamX;
  const alignedMax = maxX - seamX;
  const canDuplicate = maxX - minX <= overlap;
  return [
    seamX === 0 ? 0 : -seamX,
    ...(canDuplicate && alignedMin < overlap ? [width - maxX] : []),
    ...(canDuplicate && alignedMax > width - overlap ? [-minX] : []),
  ].filter(
    (transform, index, transforms) => transforms.indexOf(transform) === index,
  );
}

export function screenFootprintToMapCopies(
  footprint: Footprint,
  scale: number,
  width: number,
  seamX: number,
  overlap = MAP_OVERLAP_REFERENCE_UNITS,
): Footprint[] {
  const mapFootprint: Footprint = {
    ...footprint,
    center: [footprint.center[0] / scale + seamX, footprint.center[1] / scale],
    radius: footprint.radius / scale,
  };
  return wrappedFootprintPositions(mapFootprint, width, seamX, overlap).map(
    (center) => ({ ...mapFootprint, center }),
  );
}

export function wrappedPointPositions(
  point: Point,
  width: number,
  seamX: number,
  overlap = MAP_OVERLAP_REFERENCE_UNITS,
): Point[] {
  return wrappedOffsets(point[0], point[0], width, seamX, overlap).map(
    (transform) => [point[0] + transform, point[1]],
  );
}

export function wrappedPathOffsets(
  paths: string[],
  width: number,
  seamX: number,
  overlap = MAP_OVERLAP_REFERENCE_UNITS,
): number[] {
  const xs = pathPoints(paths).map(([x]) => x);
  return wrappedOffsets(
    Math.min(...xs),
    Math.max(...xs),
    width,
    seamX,
    overlap,
  );
}

export function wrappedFootprintPositions(
  footprint: Footprint,
  width: number,
  seamX: number,
  overlap = MAP_OVERLAP_REFERENCE_UNITS,
): Point[] {
  return wrappedOffsets(
    footprint.center[0] - footprint.radius,
    footprint.center[0] + footprint.radius,
    width,
    seamX,
    overlap,
  ).map((offset) => [footprint.center[0] + offset, footprint.center[1]]);
}
export function deriveFootprint(
  points: Point[],
  threshold = MIN_FOOTPRINT_PX,
): Footprint {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const center: Point = [(minX + maxX) / 2, (minY + maxY) / 2];
  const radius = Math.max(maxX - minX, maxY - minY) / 2;
  return radius * 2 >= threshold
    ? { kind: 'polygon', points, center, radius }
    : { kind: 'circle', center, radius: threshold / 2 };
}
