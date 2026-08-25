import { HEIGHT, WIDTH } from './constants.mjs';

function sqDistance(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (!dx && !dy)
    return (point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) /
        (dx * dx + dy * dy),
    ),
  );
  return (
    (point[0] - (start[0] + t * dx)) ** 2 +
    (point[1] - (start[1] + t * dy)) ** 2
  );
}

function simplify(points, tolerance = 0.12) {
  if (points.length < 3) return points;
  let max = tolerance ** 2;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = sqDistance(points[i], points[0], points.at(-1));
    if (d > max) {
      index = i;
      max = d;
    }
  }
  if (!index) return [points[0], points.at(-1)];
  return [
    ...simplify(points.slice(0, index + 1), tolerance),
    ...simplify(points.slice(index), tolerance).slice(1),
  ];
}

export function project([lon, lat]) {
  return [
    +(((lon + 180) / 360) * WIDTH).toFixed(2),
    +(((90 - lat) / 180) * HEIGHT).toFixed(2),
  ];
}

function projectExact([lon, lat]) {
  return [((lon + 180) / 360) * WIDTH, ((90 - lat) / 180) * HEIGHT];
}

function cleanRing(ring) {
  const points = [];
  for (const point of ring) {
    if (
      !points.length ||
      point[0] !== points.at(-1)[0] ||
      point[1] !== points.at(-1)[1]
    )
      points.push(point);
  }
  if (
    points.length > 1 &&
    points[0][0] === points.at(-1)[0] &&
    points[0][1] === points.at(-1)[1]
  )
    points.pop();
  return points;
}

function signedArea(points) {
  return (
    points.reduce((area, point, index) => {
      const next = points[(index + 1) % points.length];
      return area + point[0] * next[1] - next[0] * point[1];
    }, 0) / 2
  );
}

function orientation(a, b, c) {
  const value = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return Math.abs(value) < Number.EPSILON ? 0 : value > 0 ? 1 : -1;
}

function hasSelfIntersection(points) {
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    for (let j = i + 1; j < points.length; j++) {
      if (
        j === i ||
        (j + 1) % points.length === i ||
        (i + 1) % points.length === j
      )
        continue;
      const c = points[j];
      const d = points[(j + 1) % points.length];
      // Natural Earth rings may touch at a repeated boundary vertex. Only a
      // proper crossing is malformed; collinear/touching contacts are not
      // rejected as self-intersections.
      if (
        orientation(a, b, c) * orientation(a, b, d) < 0 &&
        orientation(c, d, a) * orientation(c, d, b) < 0
      )
        return true;
    }
  }
  return false;
}

function validateRing(ring) {
  const cleaned = cleanRing(ring);
  const sourceClosed =
    ring.length > 1 &&
    ring[0][0] === ring.at(-1)[0] &&
    ring[0][1] === ring.at(-1)[1];
  const sourceFinite = cleaned.every((point) =>
    point.every((value) => Number.isFinite(value)),
  );
  const sourceArea =
    sourceFinite && cleaned.length >= 3 ? signedArea(cleaned) : 0;
  const sourceValid =
    sourceClosed &&
    sourceFinite &&
    cleaned.length >= 3 &&
    Math.abs(sourceArea) > Number.EPSILON &&
    !hasSelfIntersection(cleaned);
  const projected = cleaned.map(projectExact);
  const projectedFinite = projected.every((point) =>
    point.every((value) => Number.isFinite(value)),
  );
  const projectedArea =
    projectedFinite && projected.length >= 3 ? signedArea(projected) : 0;
  const projectedValid =
    projectedFinite &&
    projected.length >= 3 &&
    Math.abs(projectedArea) > Number.EPSILON &&
    !hasSelfIntersection(projected);
  return {
    cleaned,
    projected,
    sourceClosed,
    sourceValid,
    projectedValid,
    generatorInducedDegenerate: sourceValid && !projectedValid,
    area: projectedArea,
  };
}

function exactRingPath(points) {
  return (
    points.map(([x, y], index) => `${index ? 'L' : 'M'}${x},${y}`).join('') +
    'Z'
  );
}

function insetPolygonData(geometry, featureId) {
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.map((polygon, polygonIndex) => {
    const rings = polygon.map((ring, ringIndex) => {
      const checked = validateRing(ring);
      return {
        id: `${featureId}:polygon:${polygonIndex}:ring:${ringIndex}`,
        role: ringIndex === 0 ? 'exterior' : 'interior',
        containmentParentRingId:
          ringIndex === 0
            ? null
            : `${featureId}:polygon:${polygonIndex}:ring:0`,
        path: exactRingPath(checked.projected),
        sourceVertexCount: checked.cleaned.length,
        sourceClosed: checked.sourceClosed,
        sourceValid: checked.sourceValid,
        projectedValid: checked.projectedValid,
        generatorInducedDegenerate: checked.generatorInducedDegenerate,
        signedArea: checked.area,
        valid: checked.sourceValid && checked.projectedValid,
      };
    });
    return {
      id: `${featureId}:polygon:${polygonIndex}`,
      island: polygonIndex > 0,
      path: rings.map((ring) => ring.path).join(''),
      rings,
    };
  });
}

export function buildGeometryFeature(geometry, featureId, mode = 'main') {
  const paths = geometryPaths(geometry, mode === 'inset' ? 0.05 : 0.55);
  return {
    paths,
    polygons:
      mode === 'inset' ? insetPolygonData(geometry, featureId) : undefined,
  };
}

function ringPath(ring, tolerance = 0.55) {
  const simplified = simplify(ring.map(project), tolerance);
  return (
    simplified.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join('') + 'Z'
  );
}

function geometryPaths(geometry, tolerance = 0.55) {
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap((polygon) =>
    polygon.map((ring) => ringPath(ring, tolerance)),
  );
}

export function pathPoints(paths) {
  return paths.flatMap((path) =>
    [...path.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(([, x, y]) => [
      +x,
      +y,
    ]),
  );
}

export function bounds(points) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function featureKey(feature) {
  const p = feature.properties;
  return [p.ISO_A3, p.ADM0_A3, p.SOV_A3, p.GU_A3].filter(
    (value) => value && value !== '-99',
  );
}
