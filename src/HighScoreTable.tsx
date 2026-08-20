import { formatAccuracy } from './accuracy';
import { formatElapsed } from './formatElapsed';
import type { HighScoreEntry } from './highScores';

type HighScoreTableProps = {
  scores: readonly HighScoreEntry[];
  caption: string;
  emptyMessage?: string;
};

export function HighScoreTable({
  scores,
  caption,
  emptyMessage = 'No scores yet',
}: HighScoreTableProps) {
  return (
    <table className="high-score-table">
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Player</th>
          <th scope="col">Score</th>
          <th scope="col">Accuracy</th>
          <th scope="col">Time</th>
        </tr>
      </thead>
      <tbody>
        {scores.length ? (
          scores.map((entry) => (
            <tr key={entry.id}>
              <th scope="row">{entry.username}</th>
              <td>{entry.score}</td>
              <td>
                {entry.accuracy === undefined
                  ? '—'
                  : formatAccuracy(entry.accuracy)}
              </td>
              <td>
                <time>{formatElapsed(entry.elapsedMs)}</time>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={4}>{emptyMessage}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
