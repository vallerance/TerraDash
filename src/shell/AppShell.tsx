import { useState, type ReactNode } from 'react';
import type { QuizOption } from '../quizContracts';
import { parseRoute, type AppRoute } from '../routing/routes';
import { useBrowserRoute } from '../routing/useBrowserRoute';
import { AppDisclaimer, AppFooter, AppHeader } from './AppChrome';

type PageRenderers = {
  quizOptions: readonly QuizOption[];
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
  diagnostics: (route: AppRoute, navigate: (href: string) => void) => ReactNode;
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
  const pendingQuiz = quizOptions.find((quiz) => quiz.id === pendingQuizId);
  const commitQuiz = (quizId: string) =>
    navigation.navigate(
      `${route.pathname}?quiz=${encodeURIComponent(quizId)}&start=1${route.hash}`,
    );
  return (
    <main className="app-shell">
      <AppHeader selectedQuizId={selectedQuiz.id} />
      {renderQuiz({
        quizId: selectedQuiz.id,
        providerKey: route.quizId,
        autoStart: route.start,
        pendingQuiz,
        onAutoStartHandled: () => undefined,
        onSelectQuizOption: (quiz) => setPendingQuizId(quiz.id),
        onCloseQuizDialog: () => setPendingQuizId(undefined),
        onStartSelectedQuiz: commitQuiz,
      })}
      <AppFooter>
        <AppDisclaimer />
      </AppFooter>
    </main>
  );
}

export function AppShell({
  quizOptions,
  locationIds,
  defaultQuizId,
  renderQuiz,
  highScores,
  diagnostics,
}: PageRenderers) {
  const navigation = useBrowserRoute();
  const route = parseRoute(navigation.route, {
    quizIds: quizOptions.map((quiz) => quiz.id),
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
