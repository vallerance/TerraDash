import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import map from '../data/generated/map.json';
import catalog from '../data/generated/catalog.json';
import {
  deriveComponentFootprints,
  MAP_OVERLAP_REFERENCE_UNITS,
  MAP_SEAM_LONGITUDE,
  mapXForLongitude,
  wrappedPathOffsets,
  wrappedOffsets,
  type Point,
} from './footprint';
import { highlightedGeometryPaths } from './mapGeometry';
import './styles.css';

type Location = (typeof catalog)[number];
const demoIds = ['iso:FRA', 'iso:USA', 'iso:FJI', 'iso:PSE', 'iso:VAT'];
function MapView({ active }: { active: Location }) {
  const [viewportWidth, setViewportWidth] = useState(map.width);
  const highlightedPaths = highlightedGeometryPaths(active.geometryRefs);
  const seamX = mapXForLongitude(MAP_SEAM_LONGITUDE, map.width);
  const scale = viewportWidth / map.width;
  const footprints = deriveComponentFootprints(
    highlightedPaths,
    scale,
    map.width,
    undefined,
    undefined,
    seamX,
  );
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
      viewBox={`0 0 ${map.width} ${map.height}`}
      role="img"
      aria-label="Flat world map with the selected location highlighted"
    >
      <rect width={map.width} height={map.height} className="ocean" />
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
      {footprints.flatMap((footprint, index) =>
        footprint.kind === 'circle'
          ? wrappedOffsets(
              footprint.center[0] / scale + seamX - footprint.radius / scale,
              footprint.center[0] / scale + seamX + footprint.radius / scale,
              map.width,
              seamX,
              MAP_OVERLAP_REFERENCE_UNITS,
            ).map((transform, copy) => (
              <circle
                key={`${index}:${copy}`}
                className="minimum-footprint"
                cx={(footprint.center[0] / scale + seamX + transform) * scale}
                cy={footprint.center[1]}
                r={footprint.radius / scale}
                aria-hidden="true"
              />
            ))
          : [],
      )}
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
    </svg>
  );
}
function App() {
  const [selectedId, setSelectedId] = useState('iso:FRA');
  const active = useMemo(
    () => catalog.find((item) => item.id === selectedId) ?? catalog[0],
    [selectedId],
  );
  return (
    <main>
      <header>
        <p className="eyebrow">TERRADASH · FOUNDATION</p>
        <h1>Know the world, one place at a time.</h1>
        <p className="intro">
          A responsive map foundation for a 195-location geography quiz.
        </p>
      </header>
      <section className="demo-panel" aria-labelledby="demo-title">
        <div>
          <h2 id="demo-title">Highlight fixture</h2>
          <p id="status" aria-live="polite">
            Selected: {active.name} ({active.id})
          </p>
        </div>
        <label htmlFor="location">Location</label>
        <select
          id="location"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {demoIds.map((id) => {
            const item = catalog.find((entry) => entry.id === id)!;
            return (
              <option key={id} value={id}>
                {item.name}
              </option>
            );
          })}
        </select>
      </section>
      <section className="map-frame">
        <MapView active={active} />
      </section>
      <p className="disclaimer">
        Map data: Natural Earth Admin 0 countries, v5.1.1, 1:50m. Public domain.
        Boundaries are shown for gameplay visualization and do not imply
        endorsement of any boundary claim.
      </p>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
