import {
  StrictMode,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  generatedLocations as locations,
  generatedMap as map,
} from './contracts/generatedData';
import { QuizProvider } from './QuizContext';
import {
  mapLayerForQuiz,
  playableLocations,
  quizOptions,
  worldQuiz,
} from './quizContracts';
import { QuizPlayer } from './QuizPlayer';
import { mapLocationForQuizId } from './quizMapBoundary';
import { getAllHighScores } from './highScores';
import { HighScoreTable } from './HighScoreTable';
import { MapBoxShell } from './MapBoxShell';
import './styles.css';

type Location = (typeof locations)[number];
import { DiagnosticsMap, MapView } from './map/MapView';
export { DiagnosticsMap, MapView } from './map/MapView';

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

function AppDisclaimer() {
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
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = 'quiz-menu';
  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setRegionalOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
        setRegionalOpen(false);
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
        navigate(event.currentTarget.href);
      }}
    >
      {quiz.id === 'non-un'
        ? 'Non-UN Countries, Independent Territories, and Autonomous Regions'
        : quiz.name.replace(' UN Countries', '')}
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
                Regional quizzes{' '}
                <span className="quiz-submenu-arrow" aria-hidden="true" />
              </button>
              {regionalOpen && (
                <div className="quiz-submenu-popover" role="menu">
                  {regionalQuizzes.map(renderQuizLink)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function currentRoute() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function useBrowserRoute() {
  const [navigation, setNavigation] = useState(() => ({
    route: currentRoute(),
    revision: 0,
  }));
  useEffect(() => {
    const update = () =>
      setNavigation((previous) => ({
        route: currentRoute(),
        revision: previous.revision + 1,
      }));
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  const navigate = (href: string) => {
    const next = new URL(href, window.location.href);
    if (next.origin !== window.location.origin) {
      window.location.assign(next.href);
      return;
    }
    const nextRoute = `${next.pathname}${next.search}${next.hash}`;
    if (nextRoute === currentRoute()) {
      window.history.replaceState({}, '', nextRoute);
    } else {
      window.history.pushState({}, '', nextRoute);
    }
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  return { ...navigation, navigate };
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

const thumbnailViewBoxes: Record<string, string> = {
  world: '0 0 1440 720',
  africa: '600 140 380 430',
  asia: '780 80 500 380',
  europe: '600 70 330 260',
  'north-america': '250 80 500 360',
  'south-america': '420 300 300 360',
  oceania: '1030 330 360 270',
  caribbean: '430 220 260 190',
};

function QuizThumbnail({ quiz }: { quiz: (typeof quizOptions)[number] }) {
  const locationIds = new Set(quiz.locationIds);
  const paths = locations
    .filter((location) => locationIds.has(location.id))
    .flatMap((location) =>
      location.geometryRefs.flatMap(
        (ref) => map.features[ref as keyof typeof map.features]?.paths ?? [],
      ),
    );
  const viewBox =
    quiz.map?.viewBox ||
    thumbnailViewBoxes[quiz.id] ||
    thumbnailViewBoxes.world;
  return (
    <span
      className={`quiz-option-thumbnail quiz-option-thumbnail-${quiz.id}`}
      aria-hidden="true"
    >
      {paths.length > 0 ? (
        <svg viewBox={viewBox} focusable="false">
          {paths.map((path, index) => (
            <path key={index} d={path} />
          ))}
        </svg>
      ) : (
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
      )}
    </span>
  );
}

export function HighScoresPage() {
  const scores = getAllHighScores();
  return (
    <main className="standalone-page">
      <AppHeader />
      <section className="high-score-page" aria-labelledby="high-scores-title">
        <p className="eyebrow">TERRADASH · RECORDS</p>
        <h1 id="high-scores-title">High Scores</h1>
        {quizOptions.map((quiz) => (
          <section className="high-score-panel" key={quiz.id}>
            <h2>{quiz.name}</h2>
            <HighScoreTable
              scores={scores[quiz.id] ?? []}
              caption={`${quiz.name} high scores`}
            />
          </section>
        ))}
      </section>
      <AppFooter>
        <AppDisclaimer />
      </AppFooter>
    </main>
  );
}

export function DiagnosticsPage() {
  const initialId = new URLSearchParams(window.location.search).get('location');
  const initialLocation =
    (initialId ? mapLocationForQuizId(initialId) : undefined) ??
    playableLocations[0];
  const [locationId, setLocationId] = useState(initialLocation.id);
  const location = mapLocationForQuizId(locationId)!;
  return (
    <main className="diagnostics-page">
      <AppHeader />
      <section className="player-card active-player">
        <MapBoxShell
          prompt={
            <div className="quiz-prompt">
              <h1>Inspect a location</h1>
              <span className="attempts-remaining-label">
                Location selected
              </span>
            </div>
          }
          status={
            <>
              <div className="status-item status-time">
                <strong>00:00</strong>
                <small>Time</small>
              </div>
              <div className="status-item status-correct">
                <strong>0/0</strong>
                <small>Locations correct</small>
              </div>
              <div className="status-item status-accuracy">
                <strong>0.00%</strong>
                <small>Accuracy</small>
              </div>
              <div className="status-item status-remaining">
                <strong>0</strong>
                <small>Locations remaining</small>
              </div>
            </>
          }
          content={<DiagnosticsMap location={location} />}
          statusHidden
          headerOverlay={
            <label
              className="diagnostics-control"
              htmlFor="diagnostic-location"
            >
              <span>Location</span>
              <output className="diagnostics-selected-name">
                {location.name}
              </output>
              <select
                id="diagnostic-location"
                value={locationId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setLocationId(nextId);
                  history.replaceState(
                    null,
                    '',
                    `?location=${encodeURIComponent(nextId)}`,
                  );
                }}
              >
                {playableLocations.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name} ({id})
                  </option>
                ))}
              </select>
            </label>
          }
        />
      </section>
      <AppFooter>
        <AppDisclaimer />
      </AppFooter>
    </main>
  );
}

function App() {
  if (new URLSearchParams(window.location.search).get('page') === 'high-scores')
    return <HighScoresPage />;
  const requestedQuizId = new URLSearchParams(window.location.search).get(
    'quiz',
  );
  const initialQuizId = quizOptions.some((quiz) => quiz.id === requestedQuizId)
    ? requestedQuizId!
    : worldQuiz.id;
  const [selectedQuizId, setSelectedQuizId] = useState(initialQuizId);
  const [autoStart, setAutoStart] = useState(
    new URLSearchParams(window.location.search).get('start') === '1',
  );
  const selectedQuiz =
    quizOptions.find((quiz) => quiz.id === selectedQuizId) ?? worldQuiz;
  return (
    <QuizProvider
      key={selectedQuiz.id}
      quiz={selectedQuiz}
      catalog={playableLocations}
    >
      <main className="app-shell">
        <AppHeader selectedQuizId={selectedQuiz.id} />
        <QuizPlayer
          catalog={playableLocations}
          quizId={selectedQuiz.id}
          quizName={selectedQuiz.name}
          quizOptions={quizOptions}
          autoStart={autoStart}
          initialSelectedQuizId={
            new URLSearchParams(window.location.search).get('select') === '1'
              ? selectedQuiz.id
              : undefined
          }
          onAutoStartHandled={() => setAutoStart(false)}
          onSelectQuiz={(quizId) => {
            setSelectedQuizId(quizId);
            setAutoStart(true);
          }}
          renderMap={(active) => (
            <MapView
              active={mapLocationForQuizId(active.id)! as Location}
              layer={mapLayerForQuiz(
                selectedQuiz,
                mapLocationForQuizId(active.id)! as Location,
              )}
            />
          )}
          renderQuizThumbnail={(quiz) => <QuizThumbnail quiz={quiz} />}
        />
        <AppFooter>
          <AppDisclaimer />
        </AppFooter>
      </main>
    </QuizProvider>
  );
}

export function RouterApp() {
  const { route, revision } = useBrowserRoute();
  const url = new URL(window.location.href);
  if (
    url.pathname.endsWith('/diagnostics.html') ||
    url.searchParams.get('page') === 'diagnostics'
  )
    return <DiagnosticsPage key={`${route}:${revision}`} />;
  return <App key={`${route}:${revision}`} />;
}
const rootElement = document.getElementById('root');
if (rootElement)
  createRoot(rootElement).render(
    <StrictMode>
      <RouterApp />
    </StrictMode>,
  );
