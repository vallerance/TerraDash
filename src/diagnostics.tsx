import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import catalog from '../data/generated/catalog.json';
import { AppFooter, MapView } from './main';
import { MapStage } from './MapStage';
import './styles.css';

const initialId = new URLSearchParams(window.location.search).get('location');
const initialLocation =
  catalog.find(({ id }) => id === initialId) ?? catalog[0];

export function DiagnosticsMap({
  location,
}: {
  location: (typeof catalog)[number];
}) {
  return <MapStage content={<MapView active={location} />} />;
}

function Diagnostics() {
  const [locationId, setLocationId] = useState(initialLocation.id);
  const location = catalog.find(({ id }) => id === locationId)!;
  return (
    <main className="diagnostics-page">
      <header className="app-header">
        <a className="app-brand" href="./">
          TerraDash
        </a>
        <nav aria-label="Primary navigation">
          <a href="./">Quiz</a>
          <a aria-current="page" href="./diagnostics.html">
            Diagnostics
          </a>
        </nav>
      </header>
      <section className="player-card active-player diagnostics-player">
        <div className="quiz-header diagnostics-header">
          <div className="quiz-prompt-group">
            <div className="quiz-prompt">
              <h1>Inspect a location</h1>
              <label
                className="diagnostics-location"
                htmlFor="diagnostic-location"
              >
                Location
                <select
                  id="diagnostic-location"
                  value={locationId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    setLocationId(nextId);
                    history.replaceState(
                      null,
                      '',
                      `?location=${encodeURIComponent(nextId)}`,
                    );
                  }}
                >
                  {catalog.map(({ id, name }) => (
                    <option key={id} value={id}>
                      {name} ({id})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div
            className="quiz-status quiz-status-bar diagnostics-status"
            aria-hidden="true"
          >
            <div className="status-item status-time">
              <strong>00:00</strong>
              <small>Time</small>
            </div>
            <div className="status-item status-correct">
              <strong>0/0</strong>
              <small>Locations correct</small>
            </div>
            <div className="status-item status-accuracy">
              <strong>0.00%</strong>
              <small>Accuracy</small>
            </div>
            <div className="status-item status-remaining">
              <strong>0</strong>
              <small>Locations remaining</small>
            </div>
          </div>
        </div>
        <DiagnosticsMap location={location} />
      </section>
      <p className="disclaimer">
        Map data: Natural Earth Admin 0 boundary data, v5.1.1, 1:50m main map
        and 1:10m inset. Public domain. Boundaries are shown for gameplay
        visualization and do not imply endorsement of any boundary claim.
      </p>
      <AppFooter />
    </main>
  );
}

const root = document.getElementById('diagnostics-root');
if (root) createRoot(root).render(<Diagnostics />);
