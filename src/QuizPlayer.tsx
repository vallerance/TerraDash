import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { suggestionsFor } from './autocomplete';
import { useQuiz } from './QuizContext';
import type { CatalogLocation } from './quizEngine';
import { derivePanelPlacement, type PanelPlacement } from './panelPlacement';

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
  const [feedbackTone, setFeedbackTone] = useState<'correct' | 'missed' | ''>(
    '',
  );
  const feedbackTimer = useRef<number | undefined>(undefined);
  const [panelPlacement, setPanelPlacement] = useState<PanelPlacement>({
    left: 16,
    top: 16,
  });
  const answerRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const manualPlacement = useRef(false);
  const dragRef = useRef<
    | {
        pointerId: number;
        startX: number;
        startY: number;
        left: number;
        top: number;
      }
    | undefined
  >(undefined);
  const submitting = useRef(false);
  const suggestions = useMemo(
    () => suggestionsFor(catalog, text),
    [catalog, text],
  );
  const hasQuery = text.trim().length > 0;
  const exactMatch = suggestions.some(
    (location) =>
      location.name.trim().toLowerCase() === text.trim().toLowerCase(),
  );
  const dropdownOpen = hasQuery && !exactMatch;
  const visibleSuggestions = dropdownOpen ? suggestions : [];
  const currentId =
    state.phase === 'active' ? state.order[state.currentIndex] : undefined;
  const currentLocation = catalog.find((location) => location.id === currentId);
  const correctCount = Object.values(state.outcomes).filter(
    (outcome) => outcome.status === 'correct',
  ).length;
  const completedCount = Object.keys(state.outcomes).length;
  const countriesRemaining = state.order.length - completedCount;
  const attemptsRemaining = 3 - state.attempts;
  const attemptStateClass = `attempts-remaining-${attemptsRemaining}`;

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
    if (
      state.lastEvent.type !== 'accepted' &&
      state.lastEvent.type !== 'completed' &&
      state.lastEvent.type !== 'rejected'
    )
      return;
    if (feedbackTimer.current !== undefined) {
      window.clearTimeout(feedbackTimer.current);
      feedbackTimer.current = undefined;
    }
    if (state.lastEvent.type === 'rejected') {
      setFeedback(
        state.lastEvent.reason === 'invalid-answer'
          ? 'Choose a canonical location from the suggestions or enter its exact name.'
          : 'That action is not available right now.',
      );
    } else if (
      state.lastEvent.type === 'accepted' ||
      state.lastEvent.type === 'completed'
    ) {
      const tone =
        state.lastEvent.result === 'correct'
          ? 'correct'
          : state.lastEvent.result === 'missed'
            ? 'missed'
            : '';
      setFeedbackTone(tone);
      setFeedback(
        state.lastEvent.result === 'correct'
          ? 'Correct. Next location.'
          : state.lastEvent.result === 'missed'
            ? 'Three attempts used. The answer is not revealed.'
            : 'Incorrect. Try again; the answer is not revealed.',
      );
      if (feedbackTimer.current !== undefined)
        window.clearTimeout(feedbackTimer.current);
      feedbackTimer.current = window.setTimeout(() => {
        setFeedback('');
        setFeedbackTone('');
        feedbackTimer.current = undefined;
      }, 3000);
    }
  }, [state.lastEvent]);

  useEffect(
    () => () => {
      if (feedbackTimer.current !== undefined)
        window.clearTimeout(feedbackTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (state.phase === 'active') {
      manualPlacement.current = false;
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
        (index) => (index + 1) % Math.max(1, visibleSuggestions.length),
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestion(
        (index) =>
          (index - 1 + visibleSuggestions.length) %
          Math.max(1, visibleSuggestions.length),
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (visibleSuggestions[activeSuggestion])
        choose(visibleSuggestions[activeSuggestion]);
      else submit();
    } else if (event.key === 'Escape') {
      setText('');
      setSelectedId(undefined);
      setActiveSuggestion(0);
    }
  }

  useEffect(() => {
    if (state.phase !== 'active') return;
    const update = () => {
      if (manualPlacement.current) return;
      const stage = stageRef.current;
      const panel = panelRef.current;
      const target = stage?.querySelector<SVGGraphicsElement>('.active-fill');
      if (!stage || !panel || !target) return;
      const stageRect = stage.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      setPanelPlacement(
        derivePanelPlacement(
          {
            left: targetRect.left - stageRect.left,
            top: targetRect.top - stageRect.top,
            width: targetRect.width,
            height: targetRect.height,
          },
          { width: panel.offsetWidth, height: panel.offsetHeight },
          { width: stage.clientWidth, height: stage.clientHeight },
        ),
      );
    };
    const frame = window.requestAnimationFrame(update);
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    if (stageRef.current) observer?.observe(stageRef.current);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [state.currentIndex, state.phase, visibleSuggestions.length]);

  function movePanel(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    const stage = stageRef.current;
    const panel = panelRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !stage || !panel) return;
    const left = drag.left + event.clientX - drag.startX;
    const top = drag.top + event.clientY - drag.startY;
    setPanelPlacement({
      left: Math.max(0, Math.min(stage.clientWidth - panel.offsetWidth, left)),
      top: Math.max(0, Math.min(stage.clientHeight - panel.offsetHeight, top)),
    });
  }

  if (state.phase === 'idle') {
    return (
      <section className="player-card home-page" aria-labelledby="start-title">
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
        <div className="quiz-header completion-header">
          <div className="quiz-prompt">
            <h1 id="results-title">Run complete</h1>
            <p
              className={`quiz-feedback ${feedbackTone ? `feedback-${feedbackTone}` : ''}`}
              aria-live="assertive"
            >
              {feedback}
            </p>
          </div>
        </div>
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
    <section
      className={`player-card active-player ${attemptStateClass}`}
      aria-labelledby="quiz-title"
    >
      <div className="quiz-header">
        <div className="quiz-prompt">
          <h1 id="quiz-title">Type the name of this country</h1>
          <span className={`attempts-remaining-label ${attemptStateClass}`}>
            {attemptsRemaining} guesses remaining
          </span>
          <p
            className={`quiz-feedback ${feedbackTone ? `feedback-${feedbackTone}` : ''}`}
            aria-live="assertive"
          >
            {feedback}
          </p>
        </div>
        <div className="quiz-status quiz-status-bar" aria-live="polite">
          <span
            className="progress"
            aria-label={`${correctCount} correct countries of ${completedCount} completed`}
          >
            {correctCount} / {completedCount} countries correct
          </span>
          <span>{formatElapsed(state.elapsedMs)}</span>
          <span>
            {countriesRemaining}{' '}
            {countriesRemaining === 1 ? 'country' : 'countries'} remaining
          </span>
        </div>
      </div>
      {currentLocation && (
        <div className="map-stage" ref={stageRef}>
          <div className="map-slot full-bleed-map">
            {renderMap(currentLocation)}
          </div>
          <div
            ref={panelRef}
            className="answer-panel"
            style={{ left: panelPlacement.left, top: panelPlacement.top }}
          >
            <button
              className="panel-move-handle"
              type="button"
              aria-label="Move answer form"
              title="Drag to move answer form"
              onPointerDown={(event) => {
                manualPlacement.current = true;
                dragRef.current = {
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startY: event.clientY,
                  left: panelPlacement.left,
                  top: panelPlacement.top,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={movePanel}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  event.currentTarget.releasePointerCapture(event.pointerId);
                dragRef.current = undefined;
              }}
              onPointerCancel={() => {
                dragRef.current = undefined;
              }}
            >
              <svg
                aria-hidden="true"
                className="panel-move-icon"
                viewBox="0 0 24 24"
                focusable="false"
              >
                <path d="M12 3 9 6h2v5H6V9l-3 3 3 3v-2h5v5H9l3 3 3-3h-2v-5h5v2l3-3-3-3v2h-5V6h2l-3-3Z" />
              </svg>
            </button>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <label className="visually-hidden" htmlFor="answer">
                Location name
              </label>
              <div className="answer-row">
                <div className="combobox-wrap">
                  <input
                    ref={answerRef}
                    id="answer"
                    placeholder="Country name"
                    role="combobox"
                    value={text}
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-controls="answer-options"
                    aria-expanded={dropdownOpen}
                    aria-activedescendant={
                      visibleSuggestions[activeSuggestion]
                        ? `answer-option-${visibleSuggestions[activeSuggestion].id}`
                        : undefined
                    }
                    onInput={(event) => {
                      setText((event.target as HTMLInputElement).value);
                      setSelectedId(undefined);
                      setActiveSuggestion(0);
                    }}
                    onKeyDown={onKeyDown}
                  />
                  {dropdownOpen && (
                    <ul
                      id="answer-options"
                      role="listbox"
                      className="suggestions"
                    >
                      {visibleSuggestions.length === 0 ? (
                        <li className="no-matches" role="status">
                          No matches
                        </li>
                      ) : (
                        visibleSuggestions.map((location, index) => (
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
                        ))
                      )}
                    </ul>
                  )}
                </div>
                <button
                  className="submit-arrow"
                  type="submit"
                  aria-label="Submit answer"
                  title="Submit answer"
                >
                  →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

export { formatElapsed };
