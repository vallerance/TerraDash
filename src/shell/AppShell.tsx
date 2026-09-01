import { useState, type ReactNode } from 'react';
import type { QuizOption } from '../contracts/quiz';
import type { NavigationOptions } from '../routing/browserHistory';
import { parseRoute, type AppRoute } from '../routing/routes';
import { useBrowserRoute } from '../routing/useBrowserRoute';
import { AppPageFrame } from './AppPageFrame';

type PageRenderers = {
  quizOptions: readonly QuizOption[];
  quizLocationIds?: Readonly<Record<string, readonly string[]>>;
  locationIds: readonly string[];
  defaultQuizId: string;
  renderQuiz: (input: {
    quizId: string;
    providerKey: string;
    autoStart: boolean;
    pendingQuiz?: QuizOption;
    onAutoStartHandled: () => void;
    onSelectQuizOption: (quiz: QuizOption) => void;
    onCloseQuizDialog: () => void;
    onStartSelectedQuiz: (quizId: string) => void;
  }) => ReactNode;
  highScores: ReactNode;
  diagnostics: (
    route: AppRoute,
    navigate: (href: string, options?: NavigationOptions) => void,
  ) => ReactNode;
};

function QuizShell({
  route,
  navigation,
  quizOptions,
  renderQuiz,
}: Pick<PageRenderers, 'quizOptions' | 'renderQuiz'> & {
  route: AppRoute;
  navigation: ReturnType<typeof useBrowserRoute>;
}) {
  const selectedQuiz = quizOptions.find((quiz) => quiz.id === route.quizId)!;
  const [pendingQuizId, setPendingQuizId] = useState<string | undefined>(
    route.select ? route.quizId : undefined,
  );
  const [autoStartConsumed, setAutoStartConsumed] = useState(false);
  const pendingQuiz = quizOptions.find((quiz) => quiz.id === pendingQuizId);
  const commitQuiz = (quizId: string) =>
    navigation.navigate(
      `${route.pathname}?quiz=${encodeURIComponent(quizId)}&start=1${route.hash}`,
    );
  return (
    <AppPageFrame selectedQuizId={selectedQuiz.id} quizOptions={quizOptions}>
      {renderQuiz({
        quizId: selectedQuiz.id,
        providerKey: route.quizId,
        autoStart: route.start && !autoStartConsumed,
        pendingQuiz,
        onAutoStartHandled: () => {
          setAutoStartConsumed(true);
        },
        onSelectQuizOption: (quiz) => setPendingQuizId(quiz.id),
        onCloseQuizDialog: () => setPendingQuizId(undefined),
        onStartSelectedQuiz: commitQuiz,
      })}
    </AppPageFrame>
  );
}

export function AppShell({
  quizOptions,
  quizLocationIds,
  locationIds,
  defaultQuizId,
  renderQuiz,
  highScores,
  diagnostics,
}: PageRenderers) {
  const navigation = useBrowserRoute();
  const route = parseRoute(navigation.route, {
    quizIds: quizOptions.map((quiz) => quiz.id),
    quizLocationIds: quizLocationIds ?? {},
    locationIds,
    defaultQuizId,
  });
  if (route.page === 'high-scores') return <>{highScores}</>;
  if (route.page === 'diagnostics') {
    return <>{diagnostics(route, navigation.navigate)}</>;
  }
  return (
    <QuizShell
      key={`${navigation.route}:${navigation.revision}`}
      route={route}
      navigation={navigation}
      quizOptions={quizOptions}
      renderQuiz={renderQuiz}
    />
  );
}
