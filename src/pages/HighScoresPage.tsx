import { AppDisclaimer, AppFooter, AppHeader } from '../shell/AppChrome';
import { quizOptions } from '../quizContracts';
import { getAllHighScores } from '../highScores';
import { HighScoreTable } from '../HighScoreTable';

export function HighScoresPage() {
  const scores = getAllHighScores();
  return (
    <main className="standalone-page">
      <AppHeader />
      <section className="high-score-page" aria-labelledby="high-scores-title">
        <p className="eyebrow">TERRADASH · RECORDS</p>
        <h1 id="high-scores-title">High Scores</h1>
        {quizOptions.map((quiz) => (
          <section className="high-score-panel" key={quiz.id}>
            <h2>{quiz.name}</h2>
            <HighScoreTable
              scores={scores[quiz.id] ?? []}
              caption={`${quiz.name} high scores`}
            />
          </section>
        ))}
      </section>
      <AppFooter>
        <AppDisclaimer />
      </AppFooter>
    </main>
  );
}
