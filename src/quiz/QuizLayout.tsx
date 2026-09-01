import { useEffect, type ReactNode, type Ref } from 'react';
import { MapBoxShell } from '../MapBoxShell';

export function QuizLayout({
  prompt,
  status,
  content,
  headerOverlay,
  stageOverlay,
  statusHidden = false,
  className = '',
  ariaLabelledBy,
  stageRef,
  preserveViewportHeight = false,
}: {
  prompt: ReactNode;
  status: ReactNode;
  content?: ReactNode;
  headerOverlay?: ReactNode;
  stageOverlay?: ReactNode;
  statusHidden?: boolean;
  className?: string;
  ariaLabelledBy?: string;
  stageRef?: Ref<HTMLDivElement>;
  preserveViewportHeight?: boolean;
}) {
  useEffect(() => {
    if (!preserveViewportHeight) return;
    const shell = document.querySelector<HTMLElement>('main.app-shell');
    if (!shell) return;
    const updateHeight = () => {
      shell.style.setProperty(
        '--active-quiz-height',
        `${window.innerHeight}px`,
      );
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    window.visualViewport?.addEventListener('resize', updateHeight);
    return () => {
      window.removeEventListener('resize', updateHeight);
      window.visualViewport?.removeEventListener('resize', updateHeight);
      shell.style.removeProperty('--active-quiz-height');
    };
  }, [preserveViewportHeight]);

  return (
    <section
      className={['player-card active-player quiz-layout', className]
        .filter(Boolean)
        .join(' ')}
      aria-labelledby={ariaLabelledBy}
    >
      <MapBoxShell
        prompt={prompt}
        status={status}
        content={content}
        headerOverlay={headerOverlay}
        stageOverlay={stageOverlay}
        statusHidden={statusHidden}
        ref={stageRef}
      />
    </section>
  );
}
