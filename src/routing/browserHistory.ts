export type HistorySurface = {
  location: Location;
  history: History;
  addEventListener: Window['addEventListener'];
  removeEventListener: Window['removeEventListener'];
  dispatchEvent: Window['dispatchEvent'];
  createPopStateEvent: () => Event;
  assign: (href: string) => void;
};

export function currentRoute(
  surface: Pick<HistorySurface, 'location'>,
): string {
  return `${surface.location.pathname}${surface.location.search}${surface.location.hash}`;
}

export function createBrowserHistory(surface: HistorySurface) {
  const subscribe = (listener: () => void) => {
    const update = () => listener();
    surface.addEventListener('popstate', update);
    return () => surface.removeEventListener('popstate', update);
  };
  const navigate = (href: string) => {
    const next = new URL(href, surface.location.href);
    if (next.origin !== surface.location.origin) {
      surface.assign(next.href);
      return;
    }
    const nextRoute = `${next.pathname}${next.search}${next.hash}`;
    if (nextRoute === currentRoute(surface)) {
      surface.history.replaceState({}, '', nextRoute);
    } else {
      surface.history.pushState({}, '', nextRoute);
    }
    surface.dispatchEvent(surface.createPopStateEvent());
  };
  return { currentRoute: () => currentRoute(surface), navigate, subscribe };
}
