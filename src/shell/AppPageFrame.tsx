import { type ReactNode } from 'react';
import { AppDisclaimer, AppFooter, AppHeader } from './AppChrome';
import type { QuizOption } from '../contracts/quiz';

export function AppPageFrame({
  selectedQuizId,
  quizOptions,
  children,
}: {
  selectedQuizId?: string;
  quizOptions: readonly QuizOption[];
  children: ReactNode;
}) {
  return (
    <main className="app-shell">
      <AppHeader selectedQuizId={selectedQuizId} quizOptions={quizOptions} />
      {children}
      <AppFooter>
        <AppDisclaimer />
      </AppFooter>
    </main>
  );
}
