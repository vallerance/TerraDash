import { AppDisclaimer, AppFooter, AppHeader } from '../shell/AppChrome';
import { mapLocationForQuizId } from '../quizMapBoundary';
import type { RenderLocation } from '../quizMapBoundary';
import { DiagnosticsPanel } from '../diagnostics/DiagnosticsPanel';

export function DiagnosticsPage({
  locationId,
  onLocationChange,
}: {
  locationId: string;
  onLocationChange: (locationId: string) => void;
}) {
  const location = mapLocationForQuizId(locationId)! as RenderLocation;
  return (
    <main className="diagnostics-page">
      <AppHeader />
      <DiagnosticsPanel
        locationId={locationId}
        location={location}
        onLocationChange={onLocationChange}
      />
      <AppFooter>
        <AppDisclaimer />
      </AppFooter>
    </main>
  );
}
