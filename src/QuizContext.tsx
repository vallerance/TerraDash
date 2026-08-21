import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import {
  createEngineConfig,
  createIdleState,
  reduceQuiz,
  type CatalogLocation,
  type QuizAction,
  type QuizDefinition,
  type QuizState,
} from './quizEngine';

type QuizContextValue = {
  state: QuizState;
  dispatch: (action: QuizAction) => void;
  locationIds: readonly string[];
};
const QuizContext = createContext<QuizContextValue | null>(null);
export function QuizProvider({
  quiz,
  catalog,
  rng,
  children,
}: {
  quiz: QuizDefinition;
  catalog: CatalogLocation[];
  rng?: () => number;
  children: ReactNode;
}) {
  const config = useMemo(
    () =>
      createEngineConfig(
        quiz,
        catalog.filter((location) => quiz.locationIds.includes(location.id)),
        rng,
      ),
    [quiz, catalog, rng],
  );
  const [state, dispatch] = useReducer(
    (current: QuizState, action: QuizAction) =>
      reduceQuiz(current, action, config).state,
    undefined,
    createIdleState,
  );
  return (
    <QuizContext.Provider
      value={{ state, dispatch, locationIds: config.quiz.locationIds }}
    >
      {children}
    </QuizContext.Provider>
  );
}
export function useQuiz(): QuizContextValue {
  const value = useContext(QuizContext);
  if (!value) throw new Error('useQuiz must be used within QuizProvider');
  return value;
}
