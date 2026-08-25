import { AppShell } from '../shell/AppShell';
import { QuizPage } from '../pages/QuizPage';
import { playableLocations, quizOptions, worldQuiz } from '../contracts/quiz';
import { DiagnosticsPage } from '../pages/DiagnosticsPage';
import { HighScoresPage } from '../pages/HighScoresPage';
import type { AppRoute } from './routes';

export function RouterApp() {
  return (
    <AppShell
      quizOptions={quizOptions}
      locationIds={playableLocations.map((location) => location.id)}
      defaultQuizId={worldQuiz.id}
      renderQuiz={(input) => <QuizPage {...input} />}
      highScores={<HighScoresPage />}
      diagnostics={(route: AppRoute, navigate) => (
        <DiagnosticsPage
          locationId={route.locationId!}
          onLocationChange={(locationId) =>
            navigate(
              `${route.pathname}?location=${encodeURIComponent(locationId)}${route.hash}`,
              { replace: true },
            )
          }
        />
      )}
    />
  );
}
