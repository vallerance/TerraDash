import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppFooter, MapView } from './main';
import { MapBoxShell } from './MapBoxShell';
import { allCatalog } from './quizContracts';
import './styles.css';

const initialId = new URLSearchParams(window.location.search).get('location');
const initialLocation =
  allCatalog.find(({ id }) => id === initialId) ?? allCatalog[0];

export function DiagnosticsMap({
  location,
}: {
  location: (typeof allCatalog)[number];
}) {
  return <MapView active={location} />;
}

function Diagnostics() {
  const [locationId, setLocationId] = useState(initialLocation.id);
  const location = allCatalog.find(({ id }) => id === locationId)!;
  return (
    <main className="diagnostics-page">
      <header className="app-header">
        <a
          className="app-brand"
          href={import.meta.env.BASE_URL}
          aria-label="TerraDash home"
        >
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          <strong>TerraDash</strong>
          <span>MAP YOUR KNOWLEDGE</span>
        </a>
        <nav className="quiz-navigation" aria-label="Primary navigation">
          <a href={import.meta.env.BASE_URL}>Quiz</a>
          <a
            aria-current="page"
            href={`${import.meta.env.BASE_URL}diagnostics.html`}
          >
            Diagnostics
          </a>
        </nav>
      </header>
      <section className="player-card active-player">
        <MapBoxShell
          prompt={
            <div className="quiz-prompt">
              <h1>Inspect a location</h1>
              <span className="attempts-remaining-label">
                Location selected
              </span>
            </div>
          }
          status={
            <>
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
            </>
          }
          content={<DiagnosticsMap location={location} />}
          statusHidden
          headerOverlay={
            <label
              className="diagnostics-control"
              htmlFor="diagnostic-location"
            >
              <span>Location</span>
              <output className="diagnostics-selected-name">
                {location.name}
              </output>
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
                {allCatalog.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name} ({id})
                  </option>
                ))}
              </select>
            </label>
          }
        />
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
