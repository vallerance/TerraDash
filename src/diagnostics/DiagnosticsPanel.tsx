import { MapBoxShell } from '../MapBoxShell';
import { playableLocations } from '../contracts/playableLocation';
import { DiagnosticsMap } from '../map/MapView';
import type { RenderLocation } from '../quizMapBoundary';
import { DiagnosticsControl } from './DiagnosticsControl';

export function DiagnosticsPanel({
  locationId,
  location,
  onLocationChange,
}: {
  locationId: string;
  location: RenderLocation;
  onLocationChange: (locationId: string) => void;
}) {
  return (
    <section className="player-card active-player">
      <MapBoxShell
        prompt={
          <div className="quiz-prompt">
            <h1>Inspect a location</h1>
            <span className="attempts-remaining-label">Location selected</span>
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
          <DiagnosticsControl
            locationId={locationId}
            locations={playableLocations}
            onLocationChange={onLocationChange}
          />
        }
      />
    </section>
  );
}
