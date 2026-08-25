import { AppDisclaimer, AppFooter, AppHeader } from '../shell/AppChrome';
import { quizOptions } from '../quizContracts';
import { getAllHighScores } from '../highScores';
import { HighScoresContent } from '../high-scores/HighScoresContent';

export function HighScoresPage() {
  const scores = getAllHighScores();
  return (
    <main className="standalone-page">
      <AppHeader />
      <section className="high-score-page" aria-labelledby="high-scores-title">
        <p className="eyebrow">TERRADASH · RECORDS</p>
        <h1 id="high-scores-title">High Scores</h1>
        <HighScoresContent quizzes={quizOptions} scores={scores} />
      </section>
      <AppFooter>
        <AppDisclaimer />
      </AppFooter>
    </main>
  );
}
