import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { quizOptions } from '../contracts/quiz';
import { useBrowserRoute } from '../routing/useBrowserRoute';

export function AppFooter({ children }: { children?: ReactNode }) {
  return (
    <footer className="app-footer">
      <div className="footer-brand">
        <strong>TerraDash</strong>
        <span>Geography in motion.</span>
      </div>
      <div className="footer-meta">
        <span>Open geography · timed quizzes</span>
        <span>Natural Earth data · public domain</span>
      </div>
      {children}
    </footer>
  );
}

export function AppDisclaimer() {
  return (
    <p className="disclaimer">
      Map data: Natural Earth Admin 0 boundary data, v5.1.1, 1:50m main map and
      1:10m inset. Public domain. Boundaries are shown for gameplay
      visualization and do not imply endorsement of any boundary claim.
    </p>
  );
}

function QuizMenu({ selectedQuizId }: { selectedQuizId?: string }) {
  const { navigate } = useBrowserRoute();
  const [open, setOpen] = useState(false);
  const [regionalOpen, setRegionalOpen] = useState(false);
  const [islandsOpen, setIslandsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = 'quiz-menu';
  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setRegionalOpen(false);
        setIslandsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
        setRegionalOpen(false);
        setIslandsOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);
  const globalQuizzes = quizOptions.filter(
    (quiz) => quiz.category !== 'regional',
  );
  const regionalQuizzes = quizOptions.filter(
    (quiz) => quiz.category === 'regional',
  );
  const islandQuizzes = quizOptions.filter(
    (quiz) => quiz.category === 'islands',
  );
  const renderQuizLink = (quiz: (typeof quizOptions)[number]) => (
    <a
      key={quiz.id}
      role="menuitem"
      aria-current={quiz.id === selectedQuizId ? 'page' : undefined}
      href={`${import.meta.env.BASE_URL}?quiz=${encodeURIComponent(quiz.id)}&select=1`}
      onClick={(event) => {
        event.preventDefault();
        setOpen(false);
        setRegionalOpen(false);
        setIslandsOpen(false);
        navigate(event.currentTarget.href);
      }}
    >
      {quiz.menuLabel}
    </a>
  );
  return (
    <div className="quiz-menu" ref={menuRef}>
      <button
        className="quiz-menu-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            requestAnimationFrame(() =>
              menuRef.current
                ?.querySelector<HTMLAnchorElement>('[role="menuitem"]')
                ?.focus(),
            );
          }
        }}
      >
        Quizzes <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="quiz-menu-popover" id={menuId} role="menu">
          {globalQuizzes.map(renderQuizLink)}
          {regionalQuizzes.length > 0 && (
            <div className="quiz-submenu">
              <button
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={regionalOpen}
                onClick={() => setRegionalOpen((value) => !value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight') setRegionalOpen(true);
                }}
              >
                Regional quizzes
                <span className="quiz-submenu-arrow" aria-hidden="true" />
              </button>
              {regionalOpen && (
                <div className="quiz-submenu-popover" role="menu">
                  {regionalQuizzes.map(renderQuizLink)}
                </div>
              )}
            </div>
          )}
          {islandQuizzes.length > 0 && (
            <div className="quiz-submenu">
              <button
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={islandsOpen}
                onClick={() => setIslandsOpen((value) => !value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight') setIslandsOpen(true);
                }}
              >
                Islands quizzes{' '}
                <span className="quiz-submenu-arrow" aria-hidden="true" />
              </button>
              {islandsOpen && (
                <div className="quiz-submenu-popover" role="menu">
                  {islandQuizzes.map(renderQuizLink)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AppHeader({ selectedQuizId }: { selectedQuizId?: string }) {
  const { navigate } = useBrowserRoute();
  const navigateLink = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    navigate(event.currentTarget.href);
  };
  return (
    <header className="app-header">
      <a
        className="app-brand"
        href={import.meta.env.BASE_URL}
        aria-label="TerraDash home"
        onClick={navigateLink}
      >
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
        <strong>TerraDash</strong>
        <span>MAP YOUR KNOWLEDGE</span>
      </a>
      <nav className="quiz-navigation" aria-label="Quizzes">
        <QuizMenu selectedQuizId={selectedQuizId} />
      </nav>
      <nav className="utility-navigation" aria-label="Utilities">
        <a
          href={`${import.meta.env.BASE_URL}?page=high-scores`}
          onClick={navigateLink}
        >
          High Scores
        </a>
        <a
          href={`${import.meta.env.BASE_URL}diagnostics.html`}
          onClick={navigateLink}
        >
          Diagnostics
        </a>
      </nav>
    </header>
  );
}
