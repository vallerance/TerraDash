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
import { formatAccuracy } from './accuracy';
import { countryNameKey } from './countryName';
import { useQuiz } from './QuizContext';
import type { CatalogLocation } from './quizEngine';
import {
  derivePanelPlacement,
  panelPlacementTargets,
  type PanelPlacement,
  unionRects,
} from './panelPlacement';
import { mapWidthForStage } from './mapLayout';
import { resultMoodForScore } from './resultMood';
import { MapBoxShell } from './MapBoxShell';

type QuizPlayerProps = {
  catalog: readonly CatalogLocation[];
  renderMap: (location: CatalogLocation) => ReactNode;
  now?: () => number;
};

type FeedbackTone = 'correct' | 'incorrect' | 'missed' | '';
type TerraDashConsole = {
  completeQuiz?: () => 'completed' | 'ignored';
  [key: string]: unknown;
};

declare global {
  interface Window {
    terraDash?: TerraDashConsole;
  }
}

function FeedbackIcon({
  tone,
  animationKey,
}: {
  tone: FeedbackTone;
  animationKey: number;
}) {
  return (
    <span
      key={animationKey}
      className={`quiz-feedback-icon ${tone ? `feedback-${tone}` : ''}`}
      aria-hidden="true"
    >
      {tone && (
        <svg viewBox="0 0 48 48" focusable="false">
          <circle className="feedback-disc" cx="24" cy="24" r="22" />
          {tone === 'correct' ? (
            <path
              className="feedback-symbol feedback-check"
              d="M13 25l7 7 15-17"
            />
          ) : (
            <>
              <path
                className="feedback-symbol feedback-x-first"
                d="M16 16l16 16"
              />
              <path
                className="feedback-symbol feedback-x-second"
                d="M32 16L16 32"
              />
            </>
          )}
        </svg>
      )}
    </span>
  );
}

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
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>('');
  const [feedbackAnimationKey, setFeedbackAnimationKey] = useState(0);
  const feedbackTimer = useRef<number | undefined>(undefined);
  const [panelPlacement, setPanelPlacement] = useState<PanelPlacement>({
    left: 16,
    top: 16,
  });
  const answerRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);
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
    (location) => countryNameKey(location.name) === countryNameKey(text),
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
  const locationsRemaining = state.order.length - completedCount;
  const accuracy = completedCount ? state.score / completedCount : 0;
  const attemptsRemaining = 3 - state.attempts;
  const attemptStateClass = `attempts-remaining-${attemptsRemaining}`;

  useEffect(() => {
    const list = suggestionsRef.current;
    const option = list?.children[activeSuggestion] as HTMLElement | undefined;
    if (!list || !option) return;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTop = bottom - list.clientHeight;
  }, [activeSuggestion, text, visibleSuggestions.length]);

  useEffect(() => {
    if (state.phase !== 'active') return;
    const timer = window.setInterval(
      () => dispatch({ type: 'read-elapsed', now: now() }),
      250,
    );
    return () => window.clearInterval(timer);
  }, [dispatch, now, state.phase]);

  useEffect(() => {
    const previousObject = window.terraDash;
    const consoleObject = previousObject ?? {};
    const previousCommand = consoleObject.completeQuiz;
    const completeQuiz = () => {
      if (state.phase !== 'active') return 'ignored' as const;
      dispatch({ type: 'complete-debug', now: now() + 600_000 });
      return 'completed' as const;
    };
    consoleObject.completeQuiz = completeQuiz;
    window.terraDash = consoleObject;
    return () => {
      if (window.terraDash !== consoleObject) return;
      if (consoleObject.completeQuiz !== completeQuiz) return;
      if (previousCommand === undefined) delete consoleObject.completeQuiz;
      else consoleObject.completeQuiz = previousCommand;
      if (
        previousObject === undefined &&
        Object.keys(consoleObject).length === 0
      )
        delete window.terraDash;
    };
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
      countryNameKey(exactSelected.name) === countryNameKey(text)
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
      const stage = stageRef.current;
      const panel = panelRef.current;
      if (manualPlacement.current) return;
      const targets = stage ? panelPlacementTargets(stage) : [];
      if (!stage || !panel || targets.length === 0) return;
      const stageRect = stage.getBoundingClientRect();
      const targetRect = unionRects(
        targets.map((target) => target.getBoundingClientRect()),
      );
      if (!targetRect) return;
      const suggestionsElement = suggestionsRef.current;
      const suggestionsStyle = suggestionsElement
        ? window.getComputedStyle(suggestionsElement)
        : null;
      const suggestionsMaxHeight = suggestionsStyle
        ? Number.parseFloat(suggestionsStyle.maxHeight) || 0
        : 0;
      const suggestionsMarginTop = suggestionsStyle
        ? Number.parseFloat(suggestionsStyle.marginTop) || 0
        : 0;
      setPanelPlacement(
        derivePanelPlacement(
          {
            left: targetRect.left - stageRect.left,
            top: targetRect.top - stageRect.top,
            width: targetRect.width,
            height: targetRect.height,
          },
          {
            width: panel.offsetWidth,
            height:
              panel.offsetHeight + suggestionsMaxHeight + suggestionsMarginTop,
          },
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
    const mood = resultMoodForScore(results.finalScore);
    return (
      <section className="player-card" aria-labelledby="results-title">
        <p className="eyebrow">TERRADASH · RESULTS</p>
        <div className="quiz-header completion-header">
          <div className="quiz-prompt-group">
            <div className="quiz-prompt">
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
        <div
          className="result-score"
          aria-label={`Score ${results.finalScore}`}
        >
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
      <MapBoxShell
        prompt={
          <>
            <div className="quiz-prompt">
              <h1 id="quiz-title">Type the name of this location</h1>
              <span className={`attempts-remaining-label ${attemptStateClass}`}>
                {attemptsRemaining} guesses remaining
              </span>
            </div>
            <FeedbackIcon
              tone={feedbackTone}
              animationKey={feedbackAnimationKey}
            />
            <span className="quiz-feedback" aria-live="assertive">
              {feedback}
            </span>
          </>
        }
        status={
          <>
            <div className="status-item status-time">
              <strong>{formatElapsed(state.elapsedMs)}</strong>
              <small>Time</small>
            </div>
            <div
              className="status-item status-correct"
              aria-label={`${correctCount} correct locations of ${completedCount} completed`}
            >
              <strong>
                {correctCount}/{completedCount}
              </strong>
              <small>Locations correct</small>
              <span className="progress visually-hidden">
                {correctCount} / {completedCount} locations correct
              </span>
            </div>
            <div
              className="status-item status-accuracy"
              aria-label={`${formatAccuracy(accuracy)} accuracy`}
            >
              <strong>{formatAccuracy(accuracy)}</strong>
              <small>Accuracy</small>
            </div>
            <div className="status-item status-remaining">
              <strong>{locationsRemaining}</strong>
              <small>Locations remaining</small>
              <span className="visually-hidden">
                {locationsRemaining}{' '}
                {locationsRemaining === 1 ? 'location' : 'locations'} remaining
              </span>
            </div>
          </>
        }
        ref={stageRef}
        content={currentLocation ? renderMap(currentLocation) : undefined}
        stageOverlay={
          currentLocation ? (
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
                      placeholder="Location name"
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
                        ref={suggestionsRef}
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
                    <svg
                      aria-hidden="true"
                      className="submit-icon"
                      viewBox="0 0 24 24"
                      focusable="false"
                    >
                      <path d="M4 12h15m-6-6 6 6-6 6" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          ) : undefined
        }
      />
    </section>
  );
}

export { formatElapsed };
