import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const WIDTH = 1440;
const HEIGHT = 720;
const sourcePath = 'data/source/ne_50m_admin_0_countries.geojson';
const insetSourcePath = 'data/source/ne_10m_admin_0_countries.geojson';
const EXPECTED_SOURCE_SHA256 =
  'd7e56812e94bdb374d95021940af98f6cace2cb96827f522e3a3561242406ccc';
const SOURCE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_50m_admin_0_countries.geojson';
const INSET_SOURCE_SHA256 =
  '239eec57ac17f100a11e2536cffc56752c318b50ae765b0918ff7aab4ce8f255';
const INSET_SOURCE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_10m_admin_0_countries.geojson';
const SUPPLEMENTAL_SOURCES = [
  {
    id: 'admin1',
    path: 'data/source/ne_10m_admin_1_states_provinces.geojson',
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_10m_admin_1_states_provinces.geojson',
    sha256: '22d0e3ad85eb3e27f17cabf8ba2d50e554fbc27a87796ff891d958185da62fb5',
  },
  {
    id: 'map-unit',
    path: 'data/source/ne_10m_admin_0_map_units.geojson',
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_10m_admin_0_map_units.geojson',
    sha256: '57da82be755f4afccd8f3b14251bb2752f5df1395f47d2d86f817470c4a48862',
  },
  {
    id: 'map-subunit',
    path: 'data/source/ne_10m_admin_0_map_subunits.geojson',
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_10m_admin_0_map_subunits.geojson',
    sha256: '76896018b9265072d8063e118e46df765be0ceb54a803b1a2571ebe25b36a071',
  },
  {
    id: 'aze-adm1',
    prefix: 'gb',
    path: 'data/source/geoBoundaries-AZE-ADM1.geojson',
    url: 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/v6.0.0/releaseData/gbOpen/AZE/ADM1/geoBoundaries-AZE-ADM1.geojson',
    sha256: 'f021170f3a9ef66974555265ede713af0fe02508393c75c5fa60173e10d48666',
    license: 'Open Data Commons Open Database License 1.0',
    attribution: 'geoBoundaries v6.0.0 (source: geoBoundaries, OpenStreetMap)',
  },
];
const sourceBytes = fs.readFileSync(sourcePath);
const sourceSha256 = crypto
  .createHash('sha256')
  .update(sourceBytes)
  .digest('hex');
if (sourceSha256 !== EXPECTED_SOURCE_SHA256)
  throw new Error(
    `Natural Earth source checksum mismatch: expected ${EXPECTED_SOURCE_SHA256}, got ${sourceSha256}`,
  );
const source = JSON.parse(sourceBytes);
const insetSourceBytes = fs.readFileSync(insetSourcePath);
const insetSourceSha256 = crypto
  .createHash('sha256')
  .update(insetSourceBytes)
  .digest('hex');
if (insetSourceSha256 !== INSET_SOURCE_SHA256)
  throw new Error(
    `Natural Earth inset source checksum mismatch: expected ${INSET_SOURCE_SHA256}, got ${insetSourceSha256}`,
  );
const insetSource = JSON.parse(insetSourceBytes);
const catalog = JSON.parse(fs.readFileSync('data/catalog.json'));
const overrides = JSON.parse(fs.readFileSync('data/geometry-overrides.json'));
function parseCsv(text) {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const values = [];
      let value = '';
      let quoted = false;
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '"') {
          if (quoted && line[index + 1] === '"') {
            value += '"';
            index += 1;
          } else quoted = !quoted;
        } else if (char === ',' && !quoted) {
          values.push(value);
          value = '';
        } else value += char;
      }
      values.push(value);
      return values;
    });
}

function normalizedLabel(value) {
  return value
    ?.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function checkedSourceBytes(definition) {
  const bytes = fs.readFileSync(definition.path);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== definition.sha256)
    throw new Error(
      `${definition.id} source checksum mismatch: expected ${definition.sha256}, got ${sha256}`,
    );
  return JSON.parse(bytes);
}

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
function project([lon, lat]) {
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
function buildGeometryFeature(geometry, featureId, mode = 'main') {
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
function pathPoints(paths) {
  return paths.flatMap((path) =>
    [...path.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(([, x, y]) => [
      +x,
      +y,
    ]),
  );
}
function bounds(points) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function featureKey(feature) {
  const p = feature.properties;
  return [p.ISO_A3, p.ADM0_A3, p.SOV_A3, p.GU_A3].filter(
    (value) => value && value !== '-99',
  );
}
const features = source.features.map((feature) => {
  const { paths } = buildGeometryFeature(
    feature.geometry,
    `ne:${feature.properties.NE_ID}`,
  );
  const points = pathPoints(paths);
  const id = `ne:${feature.properties.NE_ID}`;
  const anchor =
    feature.properties.LABEL_X != null && feature.properties.LABEL_Y != null
      ? project([feature.properties.LABEL_X, feature.properties.LABEL_Y])
      : [bounds(points)[0], bounds(points)[1]];
  return {
    id,
    keys: featureKey(feature),
    paths,
    anchor,
    bounds: bounds(points),
    parts: paths.map((path, index) => {
      const partPoints = pathPoints([path]);
      return {
        id: `${id}:part:${index}`,
        paths: [path],
        anchor: [
          +(
            partPoints.reduce((sum, point) => sum + point[0], 0) /
            partPoints.length
          ).toFixed(2),
          +(
            partPoints.reduce((sum, point) => sum + point[1], 0) /
            partPoints.length
          ).toFixed(2),
        ],
        bounds: bounds(partPoints),
      };
    }),
  };
});
const supplementalFeatures = SUPPLEMENTAL_SOURCES.flatMap((definition) =>
  checkedSourceBytes(definition).features.map((feature) => {
    const p = feature.properties;
    const sourceId = p.NE_ID ?? p.ne_id ?? p.adm1_code ?? p.shapeID;
    const id = `${definition.prefix ?? 'ne'}:${definition.id}:${sourceId}`;
    const { paths } = buildGeometryFeature(feature.geometry, id);
    const points = pathPoints(paths);
    return {
      id,
      source: definition.id,
      geometry: feature.geometry,
      sourceCodes: [
        p.iso_3166_2,
        p.ISO_A2,
        p.ISO_A2_EH,
        p.iso_a2,
        p.SU_A3,
        p.ADM0_A3,
        p.adm0_a3,
      ].filter(Boolean),
      keys: [
        p.iso_3166_2,
        p.ISO_A2,
        p.ISO_A2_EH,
        p.SU_A3,
        p.ADM0_A3,
        p.adm0_a3,
        p.name,
        p.name_en,
        p.NAME,
        p.NAME_LONG,
        p.SUBUNIT,
        p.shapeID,
        p.shapeName,
        p.shapeISO,
        p.shapeGroup,
        p.shapeType,
      ].filter(Boolean),
      labels: [
        p.iso_3166_2,
        p.name,
        p.name_en,
        p.name_alt,
        p.NAME,
        p.NAME_LONG,
        p.SUBUNIT,
        p.shapeName,
      ]
        .filter(Boolean)
        .flatMap((value) => String(value).split(/[|;]/)),
      alternateLabels: String(p.name_alt ?? '')
        .split(/[|;]/)
        .filter(Boolean),
      paths,
      anchor:
        p.LABEL_X != null && p.LABEL_Y != null
          ? project([p.LABEL_X, p.LABEL_Y])
          : [bounds(points)[0], bounds(points)[1]],
      bounds: bounds(points),
    };
  }),
);
const featuresByKey = new Map();
for (const feature of features)
  for (const key of new Set(feature.keys))
    featuresByKey.set(key, [...(featuresByKey.get(key) ?? []), feature]);
const locations = catalog.map((location) => {
  const matches = featuresByKey.get(location.iso3) ?? [];
  if (!matches.length)
    throw new Error(
      `No Natural Earth feature for ${location.iso3} (${location.name})`,
    );
  const geometryRefs =
    overrides[location.id] ?? matches.map((feature) => feature.id);
  const points = matches.flatMap((feature) => pathPoints(feature.paths));
  const anchor = matches
    .map((feature) => feature.anchor)
    .reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0])
    .map((value) => +(value / matches.length).toFixed(2));
  return { ...location, geometryRefs, anchor, bounds: bounds(points) };
});

const candidateRows = parseCsv(
  fs.readFileSync('data/non-un-candidates.csv', 'utf8'),
);
const candidateHeaders = candidateRows.shift();
const candidateRecords = candidateRows.map((row) =>
  Object.fromEntries(
    candidateHeaders.map((header, index) => [header, row[index] ?? '']),
  ),
);
const NON_UN_COMPONENTS = {
  'Bouvet Island': ['BV'],
  'Christmas Island': ['CX'],
  'Cocos (Keeling) Islands': ['CC'],
  // Natural Earth has only the AZ-NX city municipality. Use the pinned
  // geoBoundaries ADM1 republic feature instead of silently using that city.
  Nakhchivan: ['63332228B45413776644545'],
  // Natural Earth's British Columbia Admin-1 feature lists "New Caledonia"
  // as a name_alt value. Use the exact NC source key so that alias matching
  // cannot attach Canada's province to the New Caledonia candidate.
  'New Caledonia': ['NC'],
  Andalusia: [
    'ES-AL',
    'ES-GR',
    'ES-H',
    'ES-J',
    'ES-MA',
    'ES-CO',
    'ES-SE',
    'ES-CA',
  ],
  Aragon: ['ES-HU', 'ES-TE', 'ES-Z'],
  'Basque Country': ['ES-BI', 'ES-SS', 'ES-VI'],
  'Canary Islands': ['ES-TF', 'ES-GC'],
  'Castile and León': [
    'ES-AV',
    'ES-BU',
    'ES-LE',
    'ES-P',
    'ES-SA',
    'ES-SG',
    'ES-SO',
    'ES-VA',
    'ES-ZA',
  ],
  'Castilla–La Mancha': ['ES-AB', 'ES-CR', 'ES-CU', 'ES-GU', 'ES-TO'],
  Catalonia: ['ES-B', 'ES-GI', 'ES-L', 'ES-T'],
  Extremadura: ['ES-BA', 'ES-CC'],
  Galicia: ['ES-C', 'ES-LU', 'ES-OR', 'ES-PO'],
  Valencia: ['ES-A', 'ES-CS', 'ES-V'],
  'Friuli-Venezia Giulia': ['IT-GO', 'IT-PN', 'IT-TS', 'IT-UD'],
  // Trentino and Bolzano/South Tyrol are intentionally excluded from the
  // Non-UN quiz because both overlap the retained Trentino-Alto Adige/Südtirol
  // region; keep their source keys only for the retained aggregate mapping.
  'Trentino-Alto Adige/Südtirol': ['IT-BZ', 'IT-TN'],
  'United States Minor Outlying Islands': [
    'JQI',
    'DQI',
    'FQI',
    'HQI',
    'WQI',
    'MQI',
    'BQI',
    'LQI',
    'KQI',
  ],
};
const NON_UN_EXACT_REFS = {
  Kosovo: ['ne:map-unit:1159321007', 'ne:map-subunit:1159321007'],
};
const NON_UN_LABEL_ALIASES = {
  'Valle d’Aosta': ['Aosta Valley', 'Val d’Aoste', 'Aoste'],
};
const supplementalByKey = new Map();
for (const feature of supplementalFeatures)
  for (const key of new Set(feature.keys))
    supplementalByKey.set(key, [
      ...(supplementalByKey.get(key) ?? []),
      feature,
    ]);
function candidateMatches(candidate) {
  const exactRefs = NON_UN_EXACT_REFS[candidate.entity];
  if (exactRefs)
    return supplementalFeatures.filter((feature) =>
      exactRefs.includes(feature.id),
    );
  const componentKeys = NON_UN_COMPONENTS[candidate.entity];
  if (componentKeys)
    return componentKeys.flatMap((key) => supplementalByKey.get(key) ?? []);
  const codes = candidate.iso_3166_2_codes
    .split(';')
    .map((code) => code.trim())
    .filter(Boolean);
  const iso2 = candidate.iso_3166_1_code;
  const labels = new Set(
    [
      candidate.entity,
      ...codes,
      ...(NON_UN_LABEL_ALIASES[candidate.entity] ?? []),
    ].map(normalizedLabel),
  );
  const matches = supplementalFeatures.filter(
    (feature) =>
      feature.keys.some((key) => codes.includes(key) || key === iso2) ||
      feature.labels.some((label) => labels.has(normalizedLabel(label))),
  );
  const expectedCountryCodes = new Set(
    [iso2, ...codes.map((code) => code.split('-')[0])]
      .filter(Boolean)
      .map((code) => code.toUpperCase()),
  );
  for (const feature of matches) {
    const codeMatch = feature.sourceCodes.some((code) =>
      [code, String(code).split('-')[0]]
        .map((value) => value.toUpperCase())
        .some((value) => expectedCountryCodes.has(value)),
    );
    const normalizedLabelMatch = feature.labels.some((label) =>
      labels.has(normalizedLabel(label)),
    );
    const knownSourceCountryCodes = feature.sourceCodes
      .map((code) => String(code).split('-')[0].toUpperCase())
      .filter((code) => !['-99', '-1'].includes(code));
    if (
      normalizedLabelMatch &&
      !codeMatch &&
      knownSourceCountryCodes.length &&
      !knownSourceCountryCodes.some((code) => expectedCountryCodes.has(code))
    )
      throw new Error(
        `Ambiguous normalized-label geometry for ${candidate.entity}: ${feature.id} conflicts with declared country codes`,
      );
  }
  return matches;
}
const nonUnCandidates = candidateRecords.map((candidate) => {
  const matches = candidateMatches(candidate);
  if (!matches.length)
    throw new Error(
      `No exact Natural Earth feature for candidate ${candidate.entity}`,
    );
  const id = `non-un:${candidate.entity
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()}`;
  const points = matches.flatMap((feature) => pathPoints(feature.paths));
  return {
    id,
    name: candidate.entity,
    geometryRefs: matches.map((feature) => feature.id),
    anchor: matches
      .map((feature) => feature.anchor)
      .reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0])
      .map((value) => +(value / matches.length).toFixed(2)),
    bounds: bounds(points),
  };
});
if (
  nonUnCandidates.some(
    (candidate) =>
      new Set(candidate.geometryRefs).size !== candidate.geometryRefs.length,
  )
)
  throw new Error('Non-UN candidate geometry refs must be unique.');
if (
  new Set(nonUnCandidates.map((candidate) => candidate.name)).size !==
  nonUnCandidates.length
)
  throw new Error('Non-UN candidate names must be unique.');
if (
  nonUnCandidates.some(
    (candidate) =>
      !candidate.geometryRefs.length ||
      candidate.geometryRefs.some(
        (ref) =>
          !ref.startsWith('ne:admin1:') &&
          !ref.startsWith('ne:map-unit:') &&
          !ref.startsWith('ne:map-subunit:') &&
          !ref.startsWith('gb:aze-adm1:'),
      ),
  )
)
  throw new Error(
    'Every non-UN candidate must use nonempty exact supplemental geometry refs.',
  );
const referencedSupplementalIds = new Set(
  nonUnCandidates.flatMap(({ geometryRefs }) => geometryRefs),
);
const playableSupplementalFeatures = supplementalFeatures.filter(({ id }) =>
  referencedSupplementalIds.has(id),
);
if (
  locations.length !== 195 ||
  new Set(locations.map((x) => x.iso3)).size !== 195
)
  throw new Error('Catalog must contain exactly 195 unique ISO3 locations');
const playableLocations = [...locations, ...nonUnCandidates];
const playableLocationIds = playableLocations.map(({ id }) => id);
const mainFeatureIds = new Set(
  [...features, ...playableSupplementalFeatures].flatMap(
    ({ id, parts = [] }) => [id, ...parts.map(({ id: partId }) => partId)],
  ),
);
if (
  playableLocations.length !== 277 ||
  new Set(playableLocationIds).size !== playableLocations.length
)
  throw new Error('Playable catalog must contain exactly 277 unique locations');
const playableLocationFeatureIds = Object.fromEntries(
  playableLocations.map((location) => [location.id, location.geometryRefs]),
);
if (
  Object.keys(playableLocationFeatureIds).length !== playableLocations.length ||
  playableLocations.some((location) =>
    location.geometryRefs.some((ref) => !mainFeatureIds.has(ref)),
  )
)
  throw new Error(
    'Every playable location must resolve to generated main geometry',
  );
const map = {
  width: WIDTH,
  height: HEIGHT,
  source: {
    product: 'Natural Earth Admin 0 countries',
    version: 'v5.1.1',
    scale: '1:50m',
    url: SOURCE_URL,
    sha256: EXPECTED_SOURCE_SHA256,
    license: 'Public domain',
    disclaimer:
      'Boundaries are shown for gameplay visualization and do not imply endorsement of any boundary claim.',
  },
  sourceFeatureIds: features.map((feature) => feature.id),
  supplementalFeatureIds: playableSupplementalFeatures.map(
    (feature) => feature.id,
  ),
  locationFeatureIds: playableLocationFeatureIds,
  features: Object.fromEntries(
    [...features, ...playableSupplementalFeatures].flatMap(
      ({ id, paths, anchor, bounds, parts = [] }) => [
        [id, { paths, anchor, bounds }],
        ...parts.map(
          ({
            id: partId,
            paths: partPaths,
            anchor: partAnchor,
            bounds: partBounds,
          }) => [
            partId,
            { paths: partPaths, anchor: partAnchor, bounds: partBounds },
          ],
        ),
      ],
    ),
  ),
};
fs.mkdirSync('data/generated', { recursive: true });
fs.writeFileSync(
  'data/generated/map.json',
  JSON.stringify(map, null, 2) + '\n',
);
fs.writeFileSync(
  'data/generated/catalog.json',
  JSON.stringify(locations, null, 2) + '\n',
);
fs.writeFileSync(
  'data/generated/quiz.json',
  JSON.stringify(
    { id: 'world-195', locationIds: locations.map((x) => x.id) },
    null,
    2,
  ) + '\n',
);
fs.writeFileSync(
  'data/generated/non-un-candidates.json',
  JSON.stringify(nonUnCandidates, null, 2) + '\n',
);
fs.writeFileSync(
  'data/generated/manifest.json',
  JSON.stringify(
    {
      sourceSha256: EXPECTED_SOURCE_SHA256,
      sourceUrl: SOURCE_URL,
      supplementalSources: SUPPLEMENTAL_SOURCES,
      generatedAt: 'deterministic',
      featureIds: Object.keys(map.features),
      locations: playableLocationFeatureIds,
      nonUnCandidates: Object.fromEntries(
        nonUnCandidates.map((x) => [x.name, x.geometryRefs]),
      ),
      inset: {
        sourceSha256: INSET_SOURCE_SHA256,
        sourceUrl: INSET_SOURCE_URL,
        artifact: 'data/generated/inset.json',
        featureIds: insetSource.features.map(
          (feature) => `ne:${feature.properties.NE_ID}`,
        ),
      },
    },
    null,
    2,
  ) + '\n',
);
const insetFeatures = insetSource.features.map((feature) => {
  const id = `ne:${feature.properties.NE_ID}`;
  const { paths, polygons } = buildGeometryFeature(
    feature.geometry,
    id,
    'inset',
  );
  const points = pathPoints(paths);
  return {
    id,
    keys: featureKey(feature),
    paths,
    polygons,
    anchor:
      feature.properties.LABEL_X != null && feature.properties.LABEL_Y != null
        ? project([feature.properties.LABEL_X, feature.properties.LABEL_Y])
        : [bounds(points)[0], bounds(points)[1]],
    bounds: bounds(points),
  };
});
const nonUnInsetFeatureIds = new Set(
  nonUnCandidates.flatMap(({ geometryRefs }) => geometryRefs),
);
const supplementalInsetFeatures = playableSupplementalFeatures
  .filter(({ id }) => nonUnInsetFeatureIds.has(id))
  .map((feature) => {
    const { paths, polygons } = buildGeometryFeature(
      feature.geometry,
      feature.id,
      'inset',
    );
    const points = pathPoints(paths);
    return {
      id: feature.id,
      paths,
      polygons,
      anchor: feature.anchor,
      bounds: bounds(points),
    };
  });
const insetFeaturesByKey = new Map();
for (const feature of insetFeatures)
  for (const key of new Set(feature.keys))
    insetFeaturesByKey.set(key, [
      ...(insetFeaturesByKey.get(key) ?? []),
      feature,
    ]);
const insetFeaturesById = new Map(
  [...insetFeatures, ...supplementalInsetFeatures].map((feature) => [
    feature.id,
    feature,
  ]),
);
const insetLocationFeatures = Object.fromEntries(
  playableLocations.map((location) => {
    const refs = location.id.startsWith('non-un:')
      ? location.geometryRefs
      : (insetFeaturesByKey.get(location.iso3) ?? []).map(({ id }) => id);
    if (!refs.length || refs.some((id) => !insetFeaturesById.has(id)))
      throw new Error(
        `No exact inset feature for every geometry ref in ${location.id}`,
      );
    return [location.id, refs];
  }),
);
if (
  Object.keys(insetLocationFeatures).length !== playableLocations.length ||
  new Set(Object.keys(insetLocationFeatures)).size !== playableLocations.length
)
  throw new Error(
    'Inset location index must have exact playable-location parity',
  );
const inset = {
  width: WIDTH,
  height: HEIGHT,
  source: {
    product:
      'Natural Earth Admin 0 countries plus supplemental Admin-1/map-unit/map-subunit regions',
    version: 'v5.1.1',
    scale: '1:10m',
    url: INSET_SOURCE_URL,
    sha256: INSET_SOURCE_SHA256,
    supplementalSources: SUPPLEMENTAL_SOURCES,
    license: 'Public domain',
    disclaimer:
      'Inset boundaries are shown for gameplay visualization and do not imply endorsement of any boundary claim.',
  },
  selection: {
    rule: 'all quiz-eligible catalog locations plus every exact supplemental feature referenced by a Non-UN candidate',
    catalogLocations: locations.length + nonUnCandidates.length,
    standardLocations: locations.length,
    nonUnCandidates: nonUnCandidates.length,
    neighborPaddingProjectedUnits: 24,
  },
  sourceFeatureIds: insetFeatures.map(({ id }) => id),
  locationFeatureIds: insetLocationFeatures,
  features: Object.fromEntries(
    [...insetFeatures, ...supplementalInsetFeatures].map(
      ({ id, paths, polygons, anchor, bounds: featureBounds }) => [
        id,
        { paths, polygons, anchor, bounds: featureBounds },
      ],
    ),
  ),
};
fs.writeFileSync(
  'data/generated/inset.json',
  JSON.stringify(inset, null, 2) + '\n',
);
const prettier = process.platform === 'win32' ? 'prettier.cmd' : 'prettier';
execFileSync(
  prettier,
  [
    '--write',
    'data/generated/catalog.json',
    'data/generated/manifest.json',
    'data/generated/map.json',
    'data/generated/quiz.json',
    'data/generated/non-un-candidates.json',
    'data/generated/inset.json',
  ],
  { stdio: 'ignore' },
);
console.log(
  `Generated ${locations.length} locations and ${features.length} source features.`,
);
