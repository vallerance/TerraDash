import { useEffect, useMemo, useState } from 'react';
import { createBrowserHistory } from './browserHistory';

export function useBrowserRoute() {
  const browserHistory = useMemo(
    () =>
      createBrowserHistory({
        location: window.location,
        history: window.history,
        addEventListener: window.addEventListener.bind(window),
        removeEventListener: window.removeEventListener.bind(window),
        dispatchEvent: window.dispatchEvent.bind(window),
        createPopStateEvent: () => new PopStateEvent('popstate'),
        assign: window.location.assign.bind(window.location),
      }),
    [],
  );
  const [navigation, setNavigation] = useState(() => ({
    route: browserHistory.currentRoute(),
    revision: 0,
  }));
  useEffect(
    () =>
      browserHistory.subscribe(() =>
        setNavigation((previous) => ({
          route: browserHistory.currentRoute(),
          revision: previous.revision + 1,
        })),
      ),
    [browserHistory],
  );
  return { ...navigation, navigate: browserHistory.navigate };
}
