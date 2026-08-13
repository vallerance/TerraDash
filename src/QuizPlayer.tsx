import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { suggestionsFor } from './autocomplete';
import { useQuiz } from './QuizContext';
import type { CatalogLocation } from './quizEngine';

type QuizPlayerProps = {
  catalog: readonly CatalogLocation[];
  renderMap: (location: CatalogLocation) => ReactNode;
  now?: () => number;
};

const monotonicNow = () => performance.now();

function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

export function QuizPlayer({
  catalog,
  renderMap,
  now = monotonicNow,
}: QuizPlayerProps) {
  const { state, dispatch } = useQuiz();
  const [text, setText] = useState('');
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [feedback, setFeedback] = useState('');
  const answerRef = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const suggestions = useMemo(
    () => suggestionsFor(catalog, text),
    [catalog, text],
  );
  const currentId =
    state.phase === 'active' ? state.order[state.currentIndex] : undefined;
  const currentLocation = catalog.find((location) => location.id === currentId);

  useEffect(() => {
    if (state.phase !== 'active') return;
    const timer = window.setInterval(
      () => dispatch({ type: 'read-elapsed', now: now() }),
      250,
    );
    return () => window.clearInterval(timer);
  }, [dispatch, now, state.phase]);

  const previousEvent = useRef(state.lastEvent);
  useEffect(() => {
    if (state.lastEvent === previousEvent.current) return;
    previousEvent.current = state.lastEvent;
    if (state.lastEvent.type === 'rejected') {
      setFeedback(
        state.lastEvent.reason === 'invalid-answer'
          ? 'Choose a canonical location from the suggestions or enter its exact name.'
          : 'That action is not available right now.',
      );
    } else if (state.lastEvent.type === 'accepted') {
      setFeedback(
        state.lastEvent.result === 'correct'
          ? 'Correct. Next location.'
          : state.lastEvent.result === 'missed'
            ? 'Three attempts used. The answer is not revealed.'
            : 'Incorrect. Try again; the answer is not revealed.',
      );
    }
  }, [state.lastEvent]);

  useEffect(() => {
    if (state.phase === 'active') {
      setText('');
      setSelectedId(undefined);
      setActiveSuggestion(0);
      answerRef.current?.focus();
    }
  }, [state.currentIndex, state.phase]);

  function start() {
    setFeedback('');
    dispatch({ type: 'start', now: now() });
  }

  function submit() {
    if (submitting.current || state.phase !== 'active') return;
    submitting.current = true;
    const exactSelected =
      selectedId && catalog.find((location) => location.id === selectedId);
    const action =
      exactSelected &&
      exactSelected.name.trim().toLowerCase() === text.trim().toLowerCase()
        ? { type: 'submit' as const, selectedId, now: now() }
        : { type: 'submit' as const, text, now: now() };
    dispatch(action);
    queueMicrotask(() => {
      submitting.current = false;
    });
  }

  function choose(location: CatalogLocation) {
    setText(location.name);
    setSelectedId(location.id);
    setActiveSuggestion(0);
    answerRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestion(
        (index) => (index + 1) % Math.max(1, suggestions.length),
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestion(
        (index) =>
          (index - 1 + suggestions.length) % Math.max(1, suggestions.length),
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const exact = catalog.find(
        (location) =>
          location.name.trim().toLowerCase() === text.trim().toLowerCase(),
      );
      if (exact && (!selectedId || selectedId === exact.id)) submit();
      else if (suggestions[activeSuggestion])
        choose(suggestions[activeSuggestion]);
      else submit();
    } else if (event.key === 'Escape') {
      setText('');
      setSelectedId(undefined);
      setActiveSuggestion(0);
    }
  }

  if (state.phase === 'idle') {
    return (
      <section className="player-card" aria-labelledby="start-title">
        <p className="eyebrow">TERRADASH · QUIZ</p>
        <h1 id="start-title">Name every place on the map.</h1>
        <p>
          Identify 195 locations with three attempts each. Correct answers earn
          weighted credit; the run is timed, and missed answers are not
          revealed.
        </p>
        <button className="primary-action" type="button" onClick={start}>
          Start quiz
        </button>
      </section>
    );
  }

  if (state.phase === 'completed') {
    const results = state.results!;
    return (
      <section className="player-card" aria-labelledby="results-title">
        <p className="eyebrow">TERRADASH · RESULTS</p>
        <h1 id="results-title">Run complete</h1>
        <dl className="results-grid">
          <div>
            <dt>Time</dt>
            <dd>{formatElapsed(results.elapsedMs)}</dd>
          </div>
          <div>
            <dt>Weighted accuracy</dt>
            <dd>{Math.round(results.accuracy * 100)}%</dd>
          </div>
          <div>
            <dt>Missed</dt>
            <dd>{results.missed}</dd>
          </div>
        </dl>
        {state.lastEvent.type === 'completed' &&
          state.lastEvent.result === 'missed' && (
            <p className="feedback" aria-live="assertive">
              Three attempts used. The answer is not revealed.
            </p>
          )}
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

  return (
    <section className="player-card" aria-labelledby="quiz-title">
      <div className="quiz-header">
        <div>
          <p className="eyebrow">TERRADASH · QUIZ</p>
          <h1 id="quiz-title">Where is this?</h1>
        </div>
        <p
          className="progress"
          aria-label={`Progress ${state.currentIndex + 1} of ${state.order.length}`}
        >
          {state.currentIndex + 1} / {state.order.length}
        </p>
      </div>
      {currentLocation && (
        <div className="map-slot">{renderMap(currentLocation)}</div>
      )}
      <div className="quiz-status" aria-live="polite">
        {formatElapsed(state.elapsedMs)} · {3 - state.attempts} attempts
        remaining
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label htmlFor="answer">Location name</label>
        <div className="combobox-wrap">
          <input
            ref={answerRef}
            id="answer"
            role="combobox"
            value={text}
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls="answer-options"
            aria-expanded={suggestions.length > 0}
            aria-activedescendant={
              suggestions[activeSuggestion]
                ? `answer-option-${suggestions[activeSuggestion].id}`
                : undefined
            }
            onInput={(event) => {
              setText((event.target as HTMLInputElement).value);
              setSelectedId(undefined);
              setActiveSuggestion(0);
            }}
            onKeyDown={onKeyDown}
          />
          {suggestions.length > 0 && (
            <ul id="answer-options" role="listbox" className="suggestions">
              {suggestions.map((location, index) => (
                <li
                  id={`answer-option-${location.id}`}
                  key={location.id}
                  role="option"
                  aria-selected={index === activeSuggestion}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    choose(location);
                  }}
                >
                  {location.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button className="primary-action" type="submit">
          Submit answer
        </button>
      </form>
      <p className="feedback" aria-live="assertive">
        {feedback}
      </p>
    </section>
  );
}

export { formatElapsed };
