import type { HighScoreEntry } from '../highScores';
import type { QuizOption } from '../quizContracts';
import { HighScoreTable } from './HighScoreTable';

export function HighScoresContent({
  quizzes,
  scores,
}: {
  quizzes: readonly QuizOption[];
  scores: Readonly<Record<string, readonly HighScoreEntry[]>>;
}) {
  return (
    <>
      {quizzes.map((quiz) => (
        <section className="high-score-panel" key={quiz.id}>
          <h2>{quiz.name}</h2>
          <HighScoreTable
            scores={scores[quiz.id] ?? []}
            caption={`${quiz.name} high scores`}
          />
        </section>
      ))}
    </>
  );
}
