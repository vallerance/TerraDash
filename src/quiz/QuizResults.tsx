import { useEffect, useRef, useState } from 'react';
import { formatAccuracy } from '../accuracy';
import { useQuiz } from '../QuizContext';
import { HighScoreTable } from '../HighScoreTable';
import { formatElapsed } from '../formatElapsed';
import { resultMoodForScore } from '../resultMood';
import {
  getHighScores,
  getPlayerName,
  recordHighScore,
  updateHighScoreName,
  type HighScoreEntry,
} from '../highScores';
import { FeedbackIcon, type FeedbackTone } from './FeedbackIcon';

export function QuizResults({
  quizId,
  quizName,
}: {
  quizId: string;
  quizName: string;
}) {
  const { state, dispatch } = useQuiz();
  const [highScores, setHighScores] = useState<HighScoreEntry[]>(() =>
    getHighScores(quizId),
  );
  const [newHighScoreId, setNewHighScoreId] = useState<string | undefined>();
  const [username, setUsername] = useState(getPlayerName);
  const recordedResult = useRef<number | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>('');
  const [feedbackAnimationKey, setFeedbackAnimationKey] = useState(0);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (state.lastEvent.type !== 'completed') return;
    const tone: FeedbackTone =
      state.lastEvent.result === 'correct'
        ? 'correct'
        : state.lastEvent.result === 'missed'
          ? 'missed'
          : 'incorrect';
    setFeedbackTone(tone);
    setFeedbackAnimationKey((value) => value + 1);
    setFeedback(
      state.lastEvent.result === 'correct'
        ? 'Correct. Next location.'
        : state.lastEvent.result === 'missed'
          ? 'Three attempts used. The answer is not revealed.'
          : 'Incorrect. Try again; the answer is not revealed.',
    );
    const timer = window.setTimeout(() => {
      setFeedback('');
      setFeedbackTone('');
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [state.lastEvent]);

  useEffect(() => {
    if (!state.results || state.completedAt === null) return;
    if (recordedResult.current === state.completedAt) return;
    recordedResult.current = state.completedAt;
    const recorded = recordHighScore(
      quizId,
      state.results.finalScore,
      state.results.elapsedMs,
      undefined,
      state.results.accuracy,
    );
    setHighScores(recorded.scores);
    setNewHighScoreId(recorded.qualifies ? recorded.entry.id : undefined);
    setUsername(recorded.entry.username);
  }, [quizId, state.completedAt, state.results]);

  const results = state.results!;
  const mood = resultMoodForScore(results.finalScore);
  const newHighScore = newHighScoreId
    ? highScores.find((entry) => entry.id === newHighScoreId)
    : undefined;

  return (
    <section
      className="player-card quiz-results"
      aria-labelledby="results-title"
    >
      <p className="eyebrow">TERRADASH · RESULTS</p>
      <div className="quiz-header completion-header">
        <div className="quiz-prompt-group">
          <div className="quiz-prompt">
            <p className="quiz-name">{quizName}</p>
            <h1 id="results-title">Run complete</h1>
          </div>
          <FeedbackIcon
            tone={feedbackTone}
            animationKey={feedbackAnimationKey}
          />
          <span className="quiz-feedback" aria-live="assertive">
            {feedback}
          </span>
        </div>
      </div>
      <div className="result-score" aria-label={`Score ${results.finalScore}`}>
        <span className="result-score-label">Score</span>
        <strong>{results.finalScore}</strong>
        <span className="result-mood">
          <span aria-hidden="true">{mood.emoji}</span>
          <span>
            {mood.label}: {mood.description}
          </span>
        </span>
      </div>
      <dl className="results-grid">
        <div>
          <dt>Time</dt>
          <dd>{formatElapsed(results.elapsedMs)}</dd>
        </div>
        <div>
          <dt>Accuracy</dt>
          <dd>{formatAccuracy(results.accuracy)}</dd>
        </div>
        <div>
          <dt>Missed</dt>
          <dd>{results.missed}</dd>
        </div>
      </dl>
      {newHighScoreId && (
        <section
          className="high-score-achieved"
          aria-labelledby="high-score-achieved-title"
        >
          <h2 id="high-score-achieved-title">High Score Achieved</h2>
          <p>Your score made the leaderboard! You may update your name now.</p>
          <div className="high-score-name">
            <label htmlFor="high-score-username">Your name</label>
            <input
              id="high-score-username"
              value={username}
              onChange={(event) => {
                const name = event.target.value;
                setUsername(name);
                setHighScores(
                  updateHighScoreName(quizId, newHighScoreId, name),
                );
              }}
              maxLength={32}
            />
          </div>
          {newHighScore && (
            <HighScoreTable
              scores={[newHighScore]}
              caption="Your qualifying high score"
            />
          )}
        </section>
      )}
      <section className="high-score-panel" aria-labelledby="quiz-high-scores">
        <h2 id="quiz-high-scores">High Scores</h2>
        <HighScoreTable scores={highScores} caption="Quiz high scores" />
      </section>
      <button
        className="primary-action"
        type="button"
        onClick={() => {
          setFeedback('');
          dispatch({ type: 'reset' });
        }}
      >
        Play again
      </button>
    </section>
  );
}
