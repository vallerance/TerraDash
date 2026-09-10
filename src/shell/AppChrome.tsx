import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  quizCategoriesFor,
  type QuizCategory,
  type QuizOption,
} from '../contracts/quiz';
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

function CategoryMenu({
  category,
  selectedQuizId,
}: {
  category: QuizCategory;
  selectedQuizId?: string;
}) {
  const { navigate } = useBrowserRoute();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = `quiz-menu-${category.id}`;
  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);
  const renderQuizLink = (quiz: QuizOption) => (
    <a
      key={quiz.id}
      role="menuitem"
      aria-current={quiz.id === selectedQuizId ? 'page' : undefined}
      href={`${import.meta.env.BASE_URL}?quiz=${encodeURIComponent(quiz.id)}&select=1`}
      onClick={(event) => {
        event.preventDefault();
        setOpen(false);
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
                ?.querySelector<HTMLElement>('[role="menuitem"]')
                ?.focus(),
            );
          }
        }}
      >
        {category.label} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="quiz-menu-popover" id={menuId} role="menu">
          {category.options.map(renderQuizLink)}
        </div>
      )}
    </div>
  );
}

export function AppHeader({
  quizOptions,
  selectedQuizId,
}: {
  quizOptions: readonly QuizOption[];
  selectedQuizId?: string;
}) {
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
        {quizCategoriesFor(quizOptions).map((category) => (
          <CategoryMenu
            key={category.id}
            category={category}
            selectedQuizId={selectedQuizId}
          />
        ))}
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
