export type Point = [number, number];
type Component = {
  pathIndex: number;
  ringIndex: number;
  points: Point[];
  center: Point;
  nativeRadius: number;
  belowThreshold: boolean;
  boundary: Point[];
};
export type CalloutModel = {
  sourceCenter: Point;
  focusCenter?: Point;
  clusterBounds?: [number, number, number, number];
  selectedPathIndices: number[];
};
export type CalloutLayout = {
  center: Point;
  radius: number;
  sourceCenter: Point;
  sourceRadius: number;
};
// The threshold is a linear projected screen span. It is not an area
// threshold; components with either rendered dimension at least 25px bypass
// the inset callout.
export const MIN_FOOTPRINT_PX = 25;
export const COMPONENT_CLUSTER_PROXIMITY_PX = 24;
export const MAP_SEAM_LONGITUDE = -170;
export const MAP_OVERLAP_REFERENCE_UNITS = 100;
export const CALLOUT_GAP_PX = 72;
export const CALLOUT_AREA_SCALE = 2;
export const CALLOUT_RADIUS_SCALE = Math.sqrt(CALLOUT_AREA_SCALE);
export const CALLOUT_MAGNIFICATION_RATIO = 5;

export function sharedInsetViewBox(center: Point, radius: number) {
  return {
    x: center[0] - radius,
    y: center[1] - radius,
    size: radius * 2,
  };
}

/** Return a bounded, source-adjacent callout layout in map/viewBox units. */
export function deriveCalloutLayout(
  callout: CalloutModel,
  scale: number,
  mapWidth: number,
  mapHeight: number,
  viewportWidth: number,
): CalloutLayout {
  // The map is intentionally wide, so its rendered height is much smaller on
  // phones. Fit the callout to that height before converting CSS pixels back
  // into viewBox units; otherwise a phone-width map clips the callout and its
  // source/leader geometry appears to overlap.
  const availableRadiusPx = Math.max(24, (mapHeight * scale - 48) / 2);
  const gapPx = CALLOUT_GAP_PX;
  const widthBoundRadiusPx = Math.max(
    16,
    ((mapWidth + MAP_OVERLAP_REFERENCE_UNITS * 2) * scale - 48 - gapPx * 2) /
      (4 * CALLOUT_RADIUS_SCALE +
        (2 * CALLOUT_RADIUS_SCALE) / CALLOUT_MAGNIFICATION_RATIO),
  );
  const radiusPx =
    Math.min(
      100,
      widthBoundRadiusPx,
      Math.max(16, Math.min(viewportWidth * 0.14, availableRadiusPx)),
    ) * CALLOUT_RADIUS_SCALE;
  const radius = radiusPx / scale;
  const sourceRadius = radius / CALLOUT_MAGNIFICATION_RATIO;
  const margin = 24 / scale;
  const gap = CALLOUT_GAP_PX / scale;
  const sourceX = Math.max(
    sourceRadius,
    Math.min(mapWidth - sourceRadius, callout.sourceCenter[0]),
  );
  const sourceY = callout.sourceCenter[1];
  const rightSide = sourceX <= mapWidth / 2;
  const preferred =
    sourceX + (rightSide ? 1 : -1) * (sourceRadius + gap + radius);
  const opposite =
    sourceX + (rightSide ? -1 : 1) * (sourceRadius + gap + radius);
  const minX = -MAP_OVERLAP_REFERENCE_UNITS + radius + margin;
  const maxX = mapWidth + MAP_OVERLAP_REFERENCE_UNITS - radius - margin;
  const preferredFits = preferred >= minX && preferred <= maxX;
  const initialCenterX = preferredFits
    ? preferred
    : Math.max(minX, Math.min(maxX, opposite));
  const minY = radius + margin;
  const maxY = mapHeight - radius - margin;
  const initialCenterY = Math.max(minY, Math.min(maxY, sourceY));
  const requiredDistance = sourceRadius + gap + radius;
  const candidates: Point[] = [
    [initialCenterX, initialCenterY],
    [minX, initialCenterY],
    [maxX, initialCenterY],
    [minX, minY],
    [minX, maxY],
    [maxX, minY],
    [maxX, maxY],
  ];
  for (const x of [minX, maxX]) {
    const dx = x - sourceX;
    if (Math.abs(dx) <= requiredDistance) {
      const dy = Math.sqrt(requiredDistance ** 2 - dx ** 2);
      for (const y of [sourceY - dy, sourceY + dy])
        if (y >= minY && y <= maxY) candidates.push([x, y]);
    }
  }
  for (const y of [minY, maxY]) {
    const dy = y - sourceY;
    if (Math.abs(dy) <= requiredDistance) {
      const dx = Math.sqrt(requiredDistance ** 2 - dy ** 2);
      for (const x of [sourceX - dx, sourceX + dx])
        if (x >= minX && x <= maxX) candidates.push([x, y]);
    }
  }
  const fittingCandidates = candidates.filter(
    ([x, y]) => Math.hypot(x - sourceX, y - sourceY) >= requiredDistance,
  );
  const [centerX, centerY] = fittingCandidates.reduce(
    (best, candidate) =>
      Math.hypot(candidate[0] - preferred, candidate[1] - sourceY) <
      Math.hypot(best[0] - preferred, best[1] - sourceY)
        ? candidate
        : best,
    fittingCandidates[0] ?? [initialCenterX, initialCenterY],
  );
  const boundedSourceY = Math.max(
    sourceRadius,
    Math.min(mapHeight - sourceRadius, sourceY),
  );
  return {
    center: [centerX, centerY],
    radius,
    sourceCenter: [sourceX, boundedSourceY],
    sourceRadius,
  };
}
export function pathPoints(paths: string[]): Point[] {
  return paths.flatMap((path) =>
    [...path.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(([, x, y]) => [
      +x,
      +y,
    ]),
  );
}

/** Signed projected area of the first ring in a generated SVG path. */
export function pathArea(path: string): number {
  const points = pathPoints([path]);
  if (points.length < 3) return 0;
  return (
    points.reduce((area, point, index) => {
      const next = points[(index + 1) % points.length];
      return area + point[0] * next[1] - next[0] * point[1];
    }, 0) / 2
  );
}

export function hasRenderableArea(path: string): boolean {
  return Math.abs(pathArea(path)) > Number.EPSILON;
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
        center: [
          (Math.min(...xs) + Math.max(...xs)) / 2,
          (Math.min(...ys) + Math.max(...ys)) / 2,
        ] as Point,
        nativeRadius,
        belowThreshold: nativeRadius * 2 < threshold,
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

export function deriveCalloutModel(
  paths: string[],
  scale: number,
  width: number,
  threshold = MIN_FOOTPRINT_PX,
  proximity = COMPONENT_CLUSTER_PROXIMITY_PX,
  seamX = 0,
): CalloutModel | undefined {
  const components = deriveComponents(paths, scale, width, threshold, seamX);
  if (
    !components.length ||
    components.some(({ belowThreshold }) => !belowThreshold)
  )
    return undefined;
  const clusters = componentClusters(components, width * scale, proximity);
  const anchor = components.reduce((largest, component) =>
    component.nativeRadius > largest.nativeRadius ? component : largest,
  );
  const cluster = clusters.find((members) => members.includes(anchor));
  if (!cluster) return undefined;
  // A dateline cluster can contain components rendered at both x=0 and
  // x=width. componentGap correctly joins those copies, but taking raw
  // bounds here would turn the seam-adjacent cluster into a world-spanning
  // source circle. Re-anchor every member to the largest component's copy
  // before deriving the source bounds.
  const anchorX = anchor.center[0];
  const points = cluster.flatMap(({ boundary }) =>
    boundary.map(([x, y]) => {
      let alignedX = x;
      while (alignedX - anchorX > (width * scale) / 2)
        alignedX -= width * scale;
      while (anchorX - alignedX > (width * scale) / 2)
        alignedX += width * scale;
      return [alignedX, y] as Point;
    }),
  );
  const minX = Math.min(...points.map(([x]) => x));
  const maxX = Math.max(...points.map(([x]) => x));
  const minY = Math.min(...points.map(([, y]) => y));
  const maxY = Math.max(...points.map(([, y]) => y));
  const center: Point = [(minX + maxX) / 2, (minY + maxY) / 2];
  const anchorCenter = anchor.center;
  return {
    sourceCenter: [center[0] / scale + seamX, center[1] / scale],
    focusCenter: [anchorCenter[0] / scale + seamX, anchorCenter[1] / scale],
    clusterBounds: [
      minX / scale + seamX,
      minY / scale,
      maxX / scale + seamX,
      maxY / scale,
    ],
    selectedPathIndices: [
      ...new Set(cluster.map(({ pathIndex }) => pathIndex)),
    ],
  };
}

/**
 * Return two common external tangents. Their endpoints lie on the source and
 * cutout circles, so the leader strokes cannot enter either circle's interior.
 */
export function calloutLeaderLines(
  source: Point,
  sourceRadius: number,
  cutout: Point,
  cutoutRadius: number,
) {
  const dx = cutout[0] - source[0];
  const dy = cutout[1] - source[1];
  const distance = Math.hypot(dx, dy);
  if (distance <= Math.abs(cutoutRadius - sourceRadius)) return [];
  const direction: Point = [dx / distance, dy / distance];
  const perpendicular: Point = [-direction[1], direction[0]];
  const tangent = Math.max(
    -1,
    Math.min(1, (sourceRadius - cutoutRadius) / distance),
  );
  const along = tangent;
  const across = Math.sqrt(Math.max(0, 1 - tangent * tangent));
  return [1, -1].map((sign) => {
    const normal: Point = [
      direction[0] * along + perpendicular[0] * across * sign,
      direction[1] * along + perpendicular[1] * across * sign,
    ];
    return {
      x1: source[0] + normal[0] * sourceRadius,
      y1: source[1] + normal[1] * sourceRadius,
      x2: cutout[0] + normal[0] * cutoutRadius,
      y2: cutout[1] + normal[1] * cutoutRadius,
    };
  });
}

function componentGap(left: Component, right: Component, worldWidth: number) {
  return Math.min(
    ...[-worldWidth, 0, worldWidth].map((shift) => {
      if (
        (isDegenerateBoundary(left.boundary) &&
          !isDegenerateBoundary(right.boundary)) ||
        (isDegenerateBoundary(right.boundary) &&
          !isDegenerateBoundary(left.boundary))
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

export function wrappedViewportBounds(
  width: number,
  seamX: number,
  overlap = MAP_OVERLAP_REFERENCE_UNITS,
): [number, number] {
  const primary = seamX === 0 ? 0 : -seamX;
  return [primary - overlap, primary + width + overlap];
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
  const [viewportMin, viewportMax] = wrappedViewportBounds(
    width,
    seamX,
    overlap,
  );
  return [primary, primary - width, primary + width].filter((transform) => {
    const transformedMin = minX + transform;
    const transformedMax = maxX + transform;
    return transformedMax >= viewportMin && transformedMin <= viewportMax;
  });
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
