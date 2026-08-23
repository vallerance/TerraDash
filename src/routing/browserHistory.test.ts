import { describe, expect, it, vi } from 'vitest';
import { createBrowserHistory, type HistorySurface } from './browserHistory';

function surface(href = 'https://example.test/TerraDash/?quiz=world') {
  const url = new URL(href);
  const listeners = new Set<() => void>();
  const history = {
    pushState: vi.fn(),
    replaceState: vi.fn(),
  } as unknown as History;
  const value: HistorySurface = {
    location: url as unknown as Location,
    history,
    addEventListener: vi.fn(
      (_type: string, listener: EventListenerOrEventListenerObject) =>
        listeners.add(listener as () => void),
    ),
    removeEventListener: vi.fn(
      (_type: string, listener: EventListenerOrEventListenerObject) =>
        listeners.delete(listener as () => void),
    ),
    dispatchEvent: vi.fn(() => true),
    createPopStateEvent: () => new Event('popstate'),
    assign: vi.fn(),
  };
  return { value, history, listeners };
}

describe('browser history adapter', () => {
  it('pushes changed routes and replaces identical routes', () => {
    const { value, history } = surface();
    const adapter = createBrowserHistory(value);
    adapter.navigate('https://example.test/TerraDash/?quiz=asia');
    expect(history.pushState).toHaveBeenCalledWith(
      {},
      '',
      '/TerraDash/?quiz=asia',
    );
    adapter.navigate('https://example.test/TerraDash/?quiz=world');
    expect(history.replaceState).toHaveBeenCalledWith(
      {},
      '',
      '/TerraDash/?quiz=world',
    );
    adapter.navigate('https://example.test/TerraDash/?quiz=asia', {
      replace: true,
    });
    expect(history.replaceState).toHaveBeenCalledWith(
      {},
      '',
      '/TerraDash/?quiz=asia',
    );
  });

  it('rejects cross-origin navigation through the injected assign seam', () => {
    const { value } = surface();
    const adapter = createBrowserHistory(value);
    adapter.navigate('https://other.test/path');
    expect(value.assign).toHaveBeenCalledWith('https://other.test/path');
    expect(value.history.pushState).not.toHaveBeenCalled();
  });

  it('subscribes and cleans up one popstate listener', () => {
    const { value, listeners } = surface();
    const adapter = createBrowserHistory(value);
    const unsubscribe = adapter.subscribe(() => undefined);
    expect(listeners.size).toBe(1);
    unsubscribe();
    expect(listeners.size).toBe(0);
  });
});
