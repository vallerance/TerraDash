import { useEffect, type ReactNode } from 'react';
import { useQuiz } from './QuizContext';
import type { CatalogLocation } from './quizEngine';
import type { QuizOption } from './contracts/quiz';
import { QuizGameplay, QuizGameplayConsole } from './quiz/QuizGameplay';
import { QuizHome } from './quiz/QuizHome';
import { QuizResults } from './results/QuizResults';
import { DiagnosticsControl } from './diagnostics/DiagnosticsControl';

type QuizPlayerProps = {
  catalog: readonly CatalogLocation[];
  renderMap: (location: CatalogLocation) => ReactNode;
  now?: () => number;
  quizName?: string;
  quizId?: string;
  quizOptions?: readonly QuizOption[];
  selectedQuizOption?: QuizOption;
  onSelectQuizOption?: (quiz: QuizOption) => void;
  onCloseQuizDialog?: () => void;
  onStartSelectedQuiz?: (quizId: string) => void;
  /** Compatibility callback for direct QuizPlayer consumers during the shell migration. */
  onSelectQuiz?: (quizId: string) => void;
  autoStart?: boolean;
  onAutoStartHandled?: () => void;
  renderQuizThumbnail?: (quiz: QuizOption) => ReactNode;
  diagnostics?: {
    initialLocationId?: string;
    onQuizChange: (quizId: string) => void;
    onLocationChange: (locationId: string) => void;
    onEndQuiz: () => void;
  };
};

const monotonicNow = () => performance.now();

export function QuizPlayer({
  catalog,
  renderMap,
  now = monotonicNow,
  quizName = 'World UN Countries',
  quizId = 'world',
  quizOptions = [],
  selectedQuizOption,
  onSelectQuizOption,
  onCloseQuizDialog,
  onStartSelectedQuiz,
  onSelectQuiz,
  autoStart = false,
  onAutoStartHandled,
  renderQuizThumbnail,
  diagnostics,
}: QuizPlayerProps) {
  const { state, dispatch } = useQuiz();

  useEffect(() => {
    if (!autoStart || state.phase !== 'idle') return;
    onAutoStartHandled?.();
    dispatch({
      type: 'start',
      now: now(),
      locationId: diagnostics?.initialLocationId,
    });
  }, [autoStart, dispatch, now, onAutoStartHandled, state.phase]);

  if (state.phase === 'idle') {
    // Auto-started players remount with an idle provider for one render. Keep
    // the quiz home out of that transition; it is not a valid diagnostics
    // surface while switching between explicitly selected quizzes.
    if (autoStart) return null;
    return (
      <QuizHome
        quizOptions={quizOptions}
        renderQuizThumbnail={renderQuizThumbnail}
        selectedQuizOption={selectedQuizOption}
        onSelectQuizOption={onSelectQuizOption}
        onCloseQuizDialog={onCloseQuizDialog}
        onStartSelectedQuiz={onStartSelectedQuiz}
        onSelectQuiz={onSelectQuiz}
        onStart={() => dispatch({ type: 'start', now: now() })}
      />
    );
  }

  if (state.phase === 'completed') {
    return (
      <>
        <QuizGameplayConsole />
        <QuizResults
          quizId={quizId}
          quizName={quizName}
          diagnostics={Boolean(diagnostics)}
        />
      </>
    );
  }

  return (
    <QuizGameplay
      catalog={catalog}
      renderMap={renderMap}
      now={now}
      quizName={quizName}
      diagnostics={Boolean(diagnostics)}
      headerOverlay={
        diagnostics ? (
          <DiagnosticsControl
            quizId={quizId}
            quizOptions={quizOptions}
            locationId={state.order[state.currentIndex] ?? ''}
            locationIds={state.order}
            onQuizChange={diagnostics.onQuizChange}
            onLocationChange={(locationId) => {
              dispatch({ type: 'select-debug', locationId, now: now() });
              diagnostics.onLocationChange(locationId);
            }}
            onEndQuiz={() => {
              dispatch({ type: 'complete-debug', now: now() + 600_000 });
              diagnostics.onEndQuiz();
            }}
          />
        ) : undefined
      }
    />
  );
}

export { formatElapsed } from './formatElapsed';
