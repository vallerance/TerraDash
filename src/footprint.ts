export type Point = [number, number];
export type Footprint = {
  kind: 'polygon' | 'circle';
  points?: Point[];
  center: Point;
  radius: number;
};
type Component = {
  pathIndex: number;
  ringIndex: number;
  points: Point[];
  footprint: Footprint;
  nativeRadius: number;
  boundary: Point[];
};
export const MIN_FOOTPRINT_PX = 10;
export const COMPONENT_CLUSTER_PROXIMITY_PX = 24;
export const MAP_SEAM_LONGITUDE = -170;
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
      const wrappedStart = next % width;
      start = xs.reduce((closest, x) =>
        Math.abs(x - wrappedStart) < Math.abs(closest - wrappedStart)
          ? x
          : closest,
      );
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
  return [...path.matchAll(/M-?[\d.]+,-?[\d.]+[^M]*/g)].map((match) => {
    return pathPoints([match[0]]);
  });
}
export function deriveComponentFootprints(
  paths: string[],
  scale: number,
  width: number,
  threshold = MIN_FOOTPRINT_PX,
  proximity = COMPONENT_CLUSTER_PROXIMITY_PX,
  seamX = 0,
): Footprint[] {
  const components = deriveComponents(paths, scale, width, threshold, seamX);
  return componentClusters(components, width * scale, proximity).flatMap(
    (cluster) => clusterFootprint(cluster, threshold),
  );
}

function deriveComponents(
  paths: string[],
  scale: number,
  width: number,
  threshold: number,
  seamX: number,
): Component[] {
  return paths.flatMap((path, pathIndex) =>
    pathPointComponents(path, width).map((component, ringIndex) => {
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
        pathIndex,
        ringIndex,
        points,
        footprint: deriveFootprint(aligned, threshold),
        nativeRadius,
        boundary: aligned,
      };
    }),
  );
}

function componentClusters(
  components: Component[],
  worldWidth: number,
  proximity: number,
): Component[][] {
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
        componentGap(components[left], components[right], worldWidth) <=
        proximity
      )
        join(left, right);
  const clusterMap = new Map<number, typeof components>();
  components.forEach((component, index) => {
    const root = find(index);
    clusterMap.set(root, [...(clusterMap.get(root) ?? []), component]);
  });
  return [...clusterMap.values()];
}

function clusterFootprint(
  cluster: Component[],
  threshold: number,
): Footprint[] {
  if (cluster.some(({ footprint }) => footprint.kind === 'polygon'))
    return cluster
      .filter(({ footprint }) => footprint.kind === 'polygon')
      .map(({ footprint }) => footprint);
  const factor = clusterScale(cluster, threshold);
  const points = cluster.flatMap(({ boundary, footprint }) =>
    boundary.map(([x, y]) => {
      const [centerX, centerY] = footprint.center;
      return [
        centerX + (x - centerX) * factor,
        centerY + (y - centerY) * factor,
      ] as Point;
    }),
  );
  const minX = Math.min(...points.map(([x]) => x));
  const maxX = Math.max(...points.map(([x]) => x));
  const minY = Math.min(...points.map(([, y]) => y));
  const maxY = Math.max(...points.map(([, y]) => y));
  const center: Point = [(minX + maxX) / 2, (minY + maxY) / 2];
  return [
    {
      kind: 'circle',
      center,
      radius: Math.max(
        threshold / 2,
        ...points.map(([x, y]) => Math.hypot(x - center[0], y - center[1])),
      ),
    },
  ];
}

function clusterScale(cluster: Component[], threshold: number) {
  return Math.max(
    1,
    ...cluster.map(({ nativeRadius }) =>
      nativeRadius ? threshold / (nativeRadius * 2) : 1,
    ),
  );
}

export function scaledComponentPaths(
  paths: string[],
  scale: number,
  width: number,
  threshold = MIN_FOOTPRINT_PX,
  proximity = COMPONENT_CLUSTER_PROXIMITY_PX,
  seamX = 0,
): string[] {
  const components = deriveComponents(paths, scale, width, threshold, seamX);
  const transforms = new Map<
    string,
    { points: Point[]; center: Point; factor: number }
  >();
  componentClusters(components, width * scale, proximity).forEach((cluster) => {
    const factor = cluster.some(({ footprint }) => footprint.kind === 'polygon')
      ? 1
      : clusterScale(cluster, threshold);
    cluster.forEach((component) => {
      transforms.set(`${component.pathIndex}:${component.ringIndex}`, {
        points: component.points,
        center: [
          component.footprint.center[0] / scale + seamX,
          component.footprint.center[1] / scale,
        ],
        factor,
      });
    });
  });
  return paths.map((path, pathIndex) => {
    let ringIndex = 0;
    return path.replace(/M-?[\d.]+,-?[\d.]+[^M]*/g, (ring) => {
      const transform = transforms.get(`${pathIndex}:${ringIndex++}`);
      if (!transform || transform.factor === 1) return ring;
      let pointIndex = 0;
      return ring.replace(/[ML](-?[\d.]+),(-?[\d.]+)/g, (command) => {
        const [x, y] = transform.points[pointIndex++];
        const [centerX, centerY] = transform.center;
        const nextX = centerX + (x - centerX) * transform.factor;
        const nextY = centerY + (y - centerY) * transform.factor;
        return `${command[0]}${nextX},${nextY}`;
      });
    });
  });
}

function componentGap(left: Component, right: Component, worldWidth: number) {
  return Math.min(
    ...[-worldWidth, 0, worldWidth].map((shift) => {
      if (
        (isDegenerateBoundary(left.boundary) &&
          right.footprint.kind === 'polygon') ||
        (isDegenerateBoundary(right.boundary) &&
          left.footprint.kind === 'polygon')
      )
        return Infinity;
      return boundaryDistance(
        left.boundary,
        right.boundary.map(([x, y]) => [x + shift, y]),
      );
    }),
  );
}

function boundaryDistance(left: Point[], right: Point[]) {
  const leftPoint = degeneratePoint(left);
  const rightPoint = degeneratePoint(right);
  if (leftPoint && rightPoint)
    return Math.hypot(
      leftPoint[0] - rightPoint[0],
      leftPoint[1] - rightPoint[1],
    );
  const leftSegments = boundarySegments(left);
  const rightSegments = boundarySegments(right);
  if (leftPoint)
    return Math.min(
      ...rightSegments.map((segment) =>
        pointSegmentDistance(leftPoint, segment),
      ),
    );
  if (rightPoint)
    return Math.min(
      ...leftSegments.map((segment) =>
        pointSegmentDistance(rightPoint, segment),
      ),
    );
  return Math.min(
    ...leftSegments.flatMap((leftSegment) =>
      rightSegments.map((rightSegment) =>
        segmentDistance(leftSegment, rightSegment),
      ),
    ),
  );
}

function degeneratePoint(points: Point[]): Point | undefined {
  return isDegenerateBoundary(points) ? points[0] : undefined;
}

function isDegenerateBoundary(points: Point[]) {
  return points.every(([x, y]) => x === points[0][0] && y === points[0][1]);
}

function boundarySegments(points: Point[]): [Point, Point][] {
  if (points.length < 2) return [];
  const segments = points
    .slice(1)
    .map((point, index) => [points[index], point] as [Point, Point]);
  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1])
    segments.push([last, first]);
  return segments;
}

function segmentDistance(left: [Point, Point], right: [Point, Point]) {
  if (segmentsIntersect(left, right)) return 0;
  return Math.min(
    pointSegmentDistance(left[0], right),
    pointSegmentDistance(left[1], right),
    pointSegmentDistance(right[0], left),
    pointSegmentDistance(right[1], left),
  );
}

function segmentsIntersect(left: [Point, Point], right: [Point, Point]) {
  const orientation = (a: Point, b: Point, c: Point) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const onSegment = (a: Point, b: Point, c: Point) =>
    Math.min(a[0], c[0]) <= b[0] &&
    b[0] <= Math.max(a[0], c[0]) &&
    Math.min(a[1], c[1]) <= b[1] &&
    b[1] <= Math.max(a[1], c[1]);
  const [a, b] = left;
  const [c, d] = right;
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  const epsilon = 1e-9;
  return (
    (((abC > epsilon && abD < -epsilon) || (abC < -epsilon && abD > epsilon)) &&
      ((cdA > epsilon && cdB < -epsilon) ||
        (cdA < -epsilon && cdB > epsilon))) ||
    (Math.abs(abC) <= epsilon && onSegment(a, c, b)) ||
    (Math.abs(abD) <= epsilon && onSegment(a, d, b)) ||
    (Math.abs(cdA) <= epsilon && onSegment(c, a, d)) ||
    (Math.abs(cdB) <= epsilon && onSegment(c, b, d))
  );
}

function pointSegmentDistance(point: Point, segment: [Point, Point]) {
  const [[x, y], [endX, endY]] = segment;
  const dx = endX - x;
  const dy = endY - y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point[0] - x, point[1] - y);
  const projection = Math.max(
    0,
    Math.min(1, ((point[0] - x) * dx + (point[1] - y) * dy) / lengthSquared),
  );
  return Math.hypot(
    point[0] - (x + projection * dx),
    point[1] - (y + projection * dy),
  );
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
  const primary = seamX === 0 ? 0 : -seamX;
  return [primary, primary - width, primary + width].filter((transform) => {
    const transformedMin = minX + transform;
    const transformedMax = maxX + transform;
    return transformedMax >= -overlap && transformedMin <= width + overlap;
  });
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
