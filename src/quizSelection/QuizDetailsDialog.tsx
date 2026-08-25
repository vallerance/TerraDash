import { createPortal } from 'react-dom';
import { useEffect, useRef } from 'react';
import type { QuizOption } from '../contracts/quiz';

export function QuizDetailsDialog({
  quiz,
  onClose,
  onStart,
}: {
  quiz: QuizOption;
  onClose: () => void;
  onStart: (quizId: string) => void;
}) {
  const returnFocus = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const close = () => {
    returnFocus.current?.focus();
    onClose();
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
  return createPortal(
    <div
      className="quiz-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className="quiz-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-dialog-title"
      >
        <button
          className="quiz-dialog-close"
          type="button"
          aria-label="Close quiz details"
          onClick={close}
        >
          ×
        </button>
        <p className="eyebrow">TERRADASH · QUIZ</p>
        <h2 id="quiz-dialog-title">{quiz.name}</h2>
        <p>{quiz.locationIds.length} locations</p>
        <p>{quiz.description}</p>
        <button
          className="primary-action"
          type="button"
          autoFocus
          onClick={() => onStart(quiz.id)}
        >
          Start {quiz.name} Quiz
        </button>
      </section>
    </div>,
    document.body,
  );
}
