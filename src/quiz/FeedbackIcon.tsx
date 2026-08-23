import type { ReactNode } from 'react';

export type FeedbackTone = 'correct' | 'incorrect' | 'missed' | '';

export function FeedbackIcon({
  tone,
  animationKey,
}: {
  tone: FeedbackTone;
  animationKey: number;
}): ReactNode {
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
