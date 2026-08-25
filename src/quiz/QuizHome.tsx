import type { ReactNode } from 'react';
import { QuizDetailsDialog } from '../quizSelection/QuizDetailsDialog';
import type { QuizOption } from '../quizContracts';

function quizDescription(quiz: QuizOption): ReactNode {
  if (quiz.id === 'world') return 'All UN Member and UN Observer states';
  if (quiz.description) return quiz.description;
  const region = quiz.name.replace(/ UN Countries$/, '');
  return `UN Member and UN Observer states in ${region}`;
}

function quizSections(quizOptions: readonly QuizOption[]) {
  const categoryLabels: Record<string, string> = {
    global: 'Countries',
    regional: 'States and Provinces',
  };
  const grouped = new Map<string, QuizOption[]>();
  for (const quiz of quizOptions) {
    const key = quiz.category ?? 'global';
    grouped.set(key, [...(grouped.get(key) ?? []), quiz]);
  }
  return [...grouped].map(([key, options]) => ({
    key,
    label: categoryLabels[key] ?? `${key} quizzes`,
    options,
  }));
}

export function QuizHome({
  quizOptions,
  renderQuizThumbnail,
  selectedQuizOption,
  onSelectQuizOption,
  onCloseQuizDialog,
  onStartSelectedQuiz,
  onSelectQuiz,
  onStart,
}: {
  quizOptions: readonly QuizOption[];
  renderQuizThumbnail?: (quiz: QuizOption) => ReactNode;
  selectedQuizOption?: QuizOption;
  onSelectQuizOption?: (quiz: QuizOption) => void;
  onCloseQuizDialog?: () => void;
  onStartSelectedQuiz?: (quizId: string) => void;
  onSelectQuiz?: (quizId: string) => void;
  onStart: () => void;
}) {
  const sections = quizSections(quizOptions);
  return (
    <section className="player-card home-page" aria-labelledby="start-title">
      <div className="home-graphic" aria-hidden="true">
        <svg viewBox="0 0 240 64" focusable="false">
          <path d="M8 44c20-18 34-18 52-3s31 17 49 2 31-18 49-3 34 16 65-6" />
          <path d="M20 22c16 10 30 10 45 0s30-10 45 0 30 10 45 0 30-10 65 2" />
          <circle cx="52" cy="34" r="4" />
          <circle cx="122" cy="31" r="4" />
          <circle cx="188" cy="34" r="4" />
        </svg>
      </div>
      <h1 id="start-title">Name every place on the map</h1>
      <ul className="home-guidance" aria-label="How TerraDash works">
        <li>Choose a quiz</li>
        <li>Identify every location with three attempts each</li>
        <li>Earn a score based on your time and accuracy</li>
        <li>Improve your next run</li>
      </ul>
      {quizOptions.length > 0 && (
        <div aria-label="Choose a quiz">
          {sections.map((section) => (
            <section
              className="quiz-option-section"
              key={section.key}
              aria-labelledby={`quiz-section-${section.key}`}
            >
              <h2 id={`quiz-section-${section.key}`}>{section.label}</h2>
              <div className="quiz-options">
                {section.options.map((option) => (
                  <button
                    className="quiz-option"
                    key={option.id}
                    type="button"
                    onClick={() => onSelectQuizOption?.(option)}
                  >
                    {renderQuizThumbnail?.(option)}
                    <strong>{option.name}</strong>
                    <span>{option.locationIds.length} locations</span>
                    <span className="quiz-option-description">
                      {quizDescription(option)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {quizOptions.length === 0 && (
        <button className="primary-action" type="button" onClick={onStart}>
          Start quiz
        </button>
      )}
      {selectedQuizOption && (
        <QuizDetailsDialog
          quiz={selectedQuizOption}
          onClose={() => onCloseQuizDialog?.()}
          onStart={(quizId) => (onStartSelectedQuiz ?? onSelectQuiz)?.(quizId)}
        />
      )}
    </section>
  );
}
