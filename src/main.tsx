import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import map from '../data/generated/map.json';
import catalog from '../data/generated/catalog.json';
import {
  deriveCalloutModel,
  deriveCalloutLayout,
  calloutLeaderLines,
  MAP_OVERLAP_REFERENCE_UNITS,
  MAP_SEAM_LONGITUDE,
  mapXForLongitude,
  wrappedOffsets,
  wrappedPathOffsets,
} from './footprint';
import { QuizProvider } from './QuizContext';
import { defaultCatalog, defaultQuiz } from './quizContracts';
import { QuizPlayer } from './QuizPlayer';
import { mapLocationForQuizId } from './quizMapBoundary';
import { highlightedGeometryPaths } from './mapGeometry';
import './styles.css';

type Location = (typeof catalog)[number];
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
  const sourceOffsets = callout
    ? wrappedOffsets(
        callout.sourceCenter[0] - callout.sourceRadius,
        callout.sourceCenter[0] + callout.sourceRadius,
        map.width,
        seamX,
        MAP_OVERLAP_REFERENCE_UNITS,
      )
    : [];
  const sourceOffset =
    callout && sourceOffsets.length
      ? sourceOffsets.reduce(
          (best, offset) =>
            Math.abs(callout.sourceCenter[0] + offset - map.width / 2) <
            Math.abs(callout.sourceCenter[0] + best - map.width / 2)
              ? offset
              : best,
          sourceOffsets[0],
        )
      : 0;
  const displayedCallout = callout
    ? {
        ...callout,
        sourceCenter: [
          callout.sourceCenter[0] + sourceOffset,
          callout.sourceCenter[1],
        ] as [number, number],
        focusCenter: [
          (callout.focusCenter ?? callout.sourceCenter)[0] + sourceOffset,
          (callout.focusCenter ?? callout.sourceCenter)[1],
        ] as [number, number],
      }
    : undefined;
  const cutoutLayout = displayedCallout
    ? deriveCalloutLayout(
        displayedCallout,
        scale,
        map.width,
        map.height,
        viewportWidth,
      )
    : undefined;
  const cutoutRadius = cutoutLayout?.radius ?? 0;
  const cutoutCenter = cutoutLayout?.center ?? [0, 0];
  const clusterBounds = displayedCallout?.clusterBounds ?? [
    (displayedCallout?.focusCenter ?? [0, 0])[0] - 1,
    (displayedCallout?.focusCenter ?? [0, 0])[1] - 1,
    (displayedCallout?.focusCenter ?? [0, 0])[0] + 1,
    (displayedCallout?.focusCenter ?? [0, 0])[1] + 1,
  ];
  const clusterSpan = Math.max(
    clusterBounds[2] - clusterBounds[0],
    clusterBounds[3] - clusterBounds[1],
  );
  const insetContextMargin = Math.max(14, clusterSpan * 1.8);
  const insetSize = Math.max(32, clusterSpan + insetContextMargin * 2);
  const insetViewBox = {
    x: (displayedCallout?.focusCenter ?? [0, 0])[0] - insetSize / 2,
    y: (displayedCallout?.focusCenter ?? [0, 0])[1] - insetSize / 2,
    size: insetSize,
  };
  const insetStrokeWidth = Math.max(1.2, insetSize * 0.04);
  const insetSelectedPointRadius = Math.min(2.5, insetSize * 0.08);
  const leaderLines = displayedCallout
    ? calloutLeaderLines(
        displayedCallout.sourceCenter,
        displayedCallout.sourceRadius,
        cutoutCenter,
        cutoutRadius,
      )
    : [];
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
      {callout && displayedCallout && (
        <g className="map-callout" aria-hidden="true">
          <defs>
            <clipPath
              id={`map-callout-clip-${active.id.replace(/[^a-z0-9]/gi, '-')}`}
            >
              <circle
                cx={cutoutCenter[0]}
                cy={cutoutCenter[1]}
                r={cutoutRadius}
              />
            </clipPath>
          </defs>
          <g
            className="callout-inset-clip"
            clipPath={`url(#map-callout-clip-${active.id.replace(/[^a-z0-9]/gi, '-')})`}
          >
            <svg
              className="callout-inset"
              x={cutoutCenter[0] - cutoutRadius}
              y={cutoutCenter[1] - cutoutRadius}
              width={cutoutRadius * 2}
              height={cutoutRadius * 2}
              viewBox={`${insetViewBox.x} ${insetViewBox.y} ${insetViewBox.size} ${insetViewBox.size}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <rect
                className="callout-inset-ocean"
                x={insetViewBox.x}
                y={insetViewBox.y}
                width={insetViewBox.size}
                height={insetViewBox.size}
              />
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
                        strokeWidth={insetStrokeWidth}
                        vectorEffect="none"
                        style={{
                          strokeWidth: insetStrokeWidth,
                          vectorEffect: 'none',
                        }}
                      />
                    ),
                  ),
                )}
              </g>
              <circle
                className="callout-selected-point"
                cx={(displayedCallout?.focusCenter ?? [0, 0])[0]}
                cy={(displayedCallout?.focusCenter ?? [0, 0])[1]}
                r={insetSelectedPointRadius}
              />
            </svg>
          </g>
          <circle
            className="callout-cutout"
            cx={cutoutCenter[0]}
            cy={cutoutCenter[1]}
            r={cutoutRadius}
          />
          <circle
            className="callout-source"
            cx={displayedCallout.sourceCenter[0]}
            cy={displayedCallout.sourceCenter[1]}
            r={displayedCallout.sourceRadius}
          />
          {leaderLines.map((line, index) => (
            <line key={index} className="callout-leader" {...line} />
          ))}
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
