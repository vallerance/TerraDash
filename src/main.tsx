import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import map from '../data/generated/map.json';
import catalog from '../data/generated/catalog.json';
import {
  deriveCalloutModel,
  MAP_OVERLAP_REFERENCE_UNITS,
  MAP_SEAM_LONGITUDE,
  mapXForLongitude,
  wrappedOffsets,
  wrappedPathOffsets,
  type Point,
} from './footprint';
import { QuizProvider } from './QuizContext';
import { defaultCatalog, defaultQuiz } from './quizContracts';
import { QuizPlayer } from './QuizPlayer';
import { mapLocationForQuizId } from './quizMapBoundary';
import { highlightedGeometryPaths } from './mapGeometry';
import './styles.css';

type Location = (typeof catalog)[number];
const CALLOUT_RADIUS_MIN_PX = 90;
const CALLOUT_RADIUS_MAX_PX = 140;
const CALLOUT_GAP_PX = 18;

export function calloutLayout(
  sourceCenter: Point,
  sourceRadius: number,
  viewportWidth: number,
  renderedMapWidth: number,
) {
  const scale = viewportWidth / renderedMapWidth;
  const radiusPx = Math.min(
    CALLOUT_RADIUS_MAX_PX,
    Math.max(CALLOUT_RADIUS_MIN_PX, viewportWidth * 0.09),
  );
  const radius = radiusPx / scale;
  const gap = CALLOUT_GAP_PX / scale;
  const leftEdge = -MAP_OVERLAP_REFERENCE_UNITS;
  const rightEdge = map.width + MAP_OVERLAP_REFERENCE_UNITS;
  const leftRoom = sourceCenter[0] - leftEdge;
  const rightRoom = rightEdge - sourceCenter[0];
  const direction = rightRoom >= leftRoom ? 1 : -1;
  const idealX = sourceCenter[0] + direction * (sourceRadius + gap + radius);
  const center: Point = [
    Math.min(rightEdge - radius, Math.max(leftEdge + radius, idealX)),
    Math.min(
      map.height - radius - gap,
      Math.max(radius + gap, sourceCenter[1]),
    ),
  ];
  return {
    center,
    direction: Math.sign(center[0] - sourceCenter[0]) || 1,
    radius,
  };
}

export function MapView({ active }: { active: Location }) {
  const [viewportWidth, setViewportWidth] = useState(map.width);
  const highlightedPaths = highlightedGeometryPaths(active.geometryRefs);
  const seamX = mapXForLongitude(MAP_SEAM_LONGITUDE, map.width);
  const renderedMapWidth = map.width + MAP_OVERLAP_REFERENCE_UNITS * 2;
  const scale = viewportWidth / renderedMapWidth;
  const callout = deriveCalloutModel(
    highlightedPaths,
    scale,
    map.width,
    undefined,
    undefined,
    seamX,
  );
  const layout = callout
    ? calloutLayout(
        callout.sourceCenter,
        callout.sourceRadius,
        viewportWidth,
        renderedMapWidth,
      )
    : undefined;
  const cutoutRadius = layout?.radius ?? 0;
  const cutoutCenter: Point = layout?.center ?? [0, 0];
  const zoom = 3;
  const wrappedPathCopies = (paths: string[]) =>
    paths.flatMap((path) =>
      wrappedPathOffsets(
        [path],
        map.width,
        seamX,
        MAP_OVERLAP_REFERENCE_UNITS,
      ).map((transform) => ({ path, transform })),
    );
  useEffect(() => {
    const frame = document.querySelector('.map-frame');
    if (!frame) return;
    const update = () =>
      setViewportWidth(frame.getBoundingClientRect().width || map.width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    const mutations = new MutationObserver(update);
    mutations.observe(frame.parentElement ?? frame, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class', 'style', 'transform'],
    });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, []);
  return (
    <svg
      className="world-map"
      viewBox={`${-MAP_OVERLAP_REFERENCE_UNITS} 0 ${renderedMapWidth} ${map.height}`}
      role="img"
      aria-label="Flat world map with the selected location highlighted"
    >
      <rect
        x={-MAP_OVERLAP_REFERENCE_UNITS}
        width={renderedMapWidth}
        height={map.height}
        className="ocean"
      />
      <g className="countries">
        {map.sourceFeatureIds.map((id) => {
          const feature = map.features[id as keyof typeof map.features];
          const copies = wrappedPathCopies(feature.paths);
          return (
            <g
              key={id}
              aria-hidden="true"
              className={
                active.geometryRefs.includes(id) ? 'country active' : 'country'
              }
            >
              {copies.map(({ path, transform }, index) => (
                <path
                  key={`${transform}:${index}`}
                  d={path}
                  transform={`translate(${transform} 0)`}
                />
              ))}
            </g>
          );
        })}
      </g>
      <g className="active-fill" aria-hidden="true">
        {wrappedPathCopies(highlightedPaths).map(
          ({ path, transform }, index) => (
            <path
              key={`${transform}:${index}`}
              d={path}
              transform={`translate(${transform} 0)`}
            />
          ),
        )}
      </g>
      <g className="active-outline" aria-hidden="true">
        {wrappedPathCopies(highlightedPaths).map(
          ({ path, transform }, index) => (
            <path
              key={`${transform}:${index}`}
              d={path}
              transform={`translate(${transform} 0)`}
            />
          ),
        )}
      </g>
      {callout && (
        <g className="map-callout" aria-hidden="true">
          <defs>
            <clipPath id="map-callout-clip">
              <circle
                cx={cutoutCenter[0]}
                cy={cutoutCenter[1]}
                r={cutoutRadius}
              />
            </clipPath>
          </defs>
          <g
            className="callout-context"
            clipPath="url(#map-callout-clip)"
            transform={`translate(${cutoutCenter[0]} ${cutoutCenter[1]}) scale(${zoom}) translate(${-callout.sourceCenter[0]} ${-callout.sourceCenter[1]})`}
          >
            {map.sourceFeatureIds.map((id) => {
              const feature = map.features[id as keyof typeof map.features];
              return (
                <g key={id} className="country">
                  {wrappedPathCopies(feature.paths).map(
                    ({ path, transform }, index) => (
                      <path
                        key={`${id}:${transform}:${index}`}
                        d={path}
                        transform={`translate(${transform} 0)`}
                      />
                    ),
                  )}
                </g>
              );
            })}
            <g className="callout-selected">
              {callout.selectedPathIndices.flatMap((pathIndex) =>
                wrappedPathCopies([highlightedPaths[pathIndex]]).map(
                  ({ path, transform }, index) => (
                    <path
                      key={`${pathIndex}:${transform}:${index}`}
                      d={path}
                      transform={`translate(${transform} 0)`}
                    />
                  ),
                ),
              )}
            </g>
          </g>
          <circle
            className="callout-cutout"
            cx={cutoutCenter[0]}
            cy={cutoutCenter[1]}
            r={cutoutRadius}
          />
          {wrappedOffsets(
            callout.sourceCenter[0] - callout.sourceRadius,
            callout.sourceCenter[0] + callout.sourceRadius,
            map.width,
            seamX,
            MAP_OVERLAP_REFERENCE_UNITS,
          ).map((offset) => (
            <circle
              key={offset}
              className="callout-source"
              cx={callout.sourceCenter[0] + offset}
              cy={callout.sourceCenter[1]}
              r={callout.sourceRadius}
            />
          ))}
          <line
            className="callout-leader"
            x1={
              callout.sourceCenter[0] +
              layout!.direction * callout.sourceRadius * 0.9
            }
            y1={callout.sourceCenter[1] - callout.sourceRadius * 0.4}
            x2={cutoutCenter[0] - layout!.direction * cutoutRadius * 0.92}
            y2={cutoutCenter[1] - cutoutRadius * 0.38}
          />
          <line
            className="callout-leader"
            x1={
              callout.sourceCenter[0] +
              layout!.direction * callout.sourceRadius * 0.9
            }
            y1={callout.sourceCenter[1] + callout.sourceRadius * 0.4}
            x2={cutoutCenter[0] - layout!.direction * cutoutRadius * 0.92}
            y2={cutoutCenter[1] + cutoutRadius * 0.38}
          />
        </g>
      )}
    </svg>
  );
}
function App() {
  return (
    <QuizProvider quiz={defaultQuiz} catalog={defaultCatalog}>
      <main>
        <QuizPlayer
          catalog={defaultCatalog}
          renderMap={(active) => (
            <section className="map-frame">
              <MapView active={mapLocationForQuizId(active.id)! as Location} />
            </section>
          )}
        />
        <p className="disclaimer">
          Map data: Natural Earth Admin 0 countries, v5.1.1, 1:50m. Public
          domain. Boundaries are shown for gameplay visualization and do not
          imply endorsement of any boundary claim.
        </p>
      </main>
    </QuizProvider>
  );
}
const rootElement = document.getElementById('root');
if (rootElement)
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
