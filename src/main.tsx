import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import map from '../data/generated/map.json';
import catalog from '../data/generated/catalog.json';
import { QuizProvider } from './QuizContext';
import { defaultCatalog, defaultQuiz } from './quizContracts';
import { QuizPlayer } from './QuizPlayer';
import { deriveComponentFootprints, type Point } from './footprint';
import { highlightedGeometryPaths } from './mapGeometry';
import './styles.css';

type Location = (typeof catalog)[number];
function MapView({ active }: { active: Location }) {
  const [viewportWidth, setViewportWidth] = useState(map.width);
  const highlightedPaths = highlightedGeometryPaths(active.geometryRefs);
  const scale = viewportWidth / map.width;
  const footprints = deriveComponentFootprints(
    highlightedPaths,
    scale,
    map.width,
  );
  useEffect(() => {
    const frame = document.querySelector('.map-frame');
    if (!frame) return;
    const update = () =>
      setViewportWidth(frame.getBoundingClientRect().width || map.width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
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
          return (
            <g
              key={id}
              aria-hidden="true"
              className={
                active.geometryRefs.includes(id) ? 'country active' : 'country'
              }
            >
              {feature.paths.map((path, index) => (
                <path key={index} d={path} />
              ))}
            </g>
          );
        })}
      </g>
      {footprints
        .filter((footprint) => footprint.kind === 'circle')
        .map((footprint, index) => {
          const circleCenter: Point = [
            (((footprint.center[0] / scale) % map.width) + map.width) %
              map.width,
            footprint.center[1] / scale,
          ];
          return (
            <circle
              key={index}
              className="minimum-footprint"
              cx={circleCenter[0]}
              cy={circleCenter[1]}
              r={footprint.radius / scale}
              aria-hidden="true"
            />
          );
        })}
      <g className="active-fill" aria-hidden="true">
        {highlightedPaths.map((path, index) => (
          <path key={index} d={path} />
        ))}
      </g>
      <g className="active-outline" aria-hidden="true">
        {highlightedPaths.map((path, index) => (
          <path key={index} d={path} />
        ))}
      </g>
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
              <MapView active={active as Location} />
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
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
