import { AppDisclaimer, AppFooter, AppHeader } from '../shell/AppChrome';
import { MapBoxShell } from '../MapBoxShell';
import { DiagnosticsMap } from '../map/MapView';
import { mapLocationForQuizId, playableLocations } from '../quizMapBoundary';
import type { CatalogLocation } from '../quizEngine';

export function DiagnosticsPage({
  locationId,
  onLocationChange,
}: {
  locationId: string;
  onLocationChange: (locationId: string) => void;
}) {
  const location = mapLocationForQuizId(locationId)! as CatalogLocation;
  return (
    <main className="diagnostics-page">
      <AppHeader />
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
                onChange={(event) => onLocationChange(event.target.value)}
              >
                {playableLocations.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name} ({id})
                  </option>
                ))}
              </select>
            </label>
          }
        />
      </section>
      <AppFooter>
        <AppDisclaimer />
      </AppFooter>
    </main>
  );
}
