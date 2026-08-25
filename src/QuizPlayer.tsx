import { useEffect, type ReactNode } from 'react';
import { useQuiz } from './QuizContext';
import type { CatalogLocation } from './quizEngine';
import type { QuizOption } from './contracts/quiz';
import { QuizGameplay, QuizGameplayConsole } from './quiz/QuizGameplay';
import { QuizHome } from './quiz/QuizHome';
import { QuizResults } from './results/QuizResults';

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
}: QuizPlayerProps) {
  const { state, dispatch } = useQuiz();

  useEffect(() => {
    if (!autoStart || state.phase !== 'idle') return;
    onAutoStartHandled?.();
    dispatch({ type: 'start', now: now() });
  }, [autoStart, dispatch, now, onAutoStartHandled, state.phase]);

  if (state.phase === 'idle') {
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
        <QuizResults quizId={quizId} quizName={quizName} />
      </>
    );
  }

  return (
    <QuizGameplay
      catalog={catalog}
      renderMap={renderMap}
      now={now}
      quizName={quizName}
    />
  );
}

export { formatElapsed } from './formatElapsed';
