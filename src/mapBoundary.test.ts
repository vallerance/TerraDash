import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { useMapViewport } from './map/useMapViewport';

describe('map extraction boundaries', () => {
  it('observes the map frame, propagates measured updates, and cleans up', () => {
    const resizeObservers: MockObserver[] = [];
    const mutationObservers: MockObserver[] = [];
    class MockResizeObserver implements MockObserver {
      target?: Element;
      disconnected = false;
      constructor(callback?: () => void) {
        this.callback = callback;
        resizeObservers.push(this);
      }
      observe(target: Element) {
        this.target = target;
      }
      disconnect() {
        this.disconnected = true;
      }
      trigger() {
        this.callback?.();
      }
      callback?: () => void;
    }
    class MockMutationObserver extends MockResizeObserver {
      constructor(callback?: () => void) {
        super(callback);
        mutationObservers.push(this);
      }
    }
    type ObserverCtor = new (callback?: () => void) => MockObserver;
    type WindowWithObservers = Window & {
      ResizeObserver: ObserverCtor;
      MutationObserver: ObserverCtor;
    };
    const resizeCtor = MockResizeObserver as unknown as ObserverCtor;
    const mutationCtor = MockMutationObserver as unknown as ObserverCtor;
    Object.assign(window as unknown as WindowWithObservers, {
      ResizeObserver: resizeCtor,
      MutationObserver: mutationCtor,
    });
    const frame = document.createElement('div');
    frame.className = 'map-frame';
    let measured = { width: 0, height: 0 };
    frame.getBoundingClientRect = () =>
      ({ width: measured.width, height: measured.height }) as DOMRect;
    document.body.append(frame);
    const host = document.createElement('div');
    document.body.append(host);
    function Probe() {
      const viewport = useMapViewport();
      return createElement(
        'output',
        null,
        `${viewport.width}x${viewport.height}`,
      );
    }
    const root = createRoot(host);
    act(() => root.render(createElement(Probe)));
    expect(host.textContent).toBe('1440x720');
    expect(resizeObservers[0].target).toBe(frame);
    measured = { width: 320, height: 180 };
    act(() => resizeObservers[0].trigger());
    expect(host.textContent).toBe('320x180');
    measured = { width: 640, height: 360 };
    act(() => mutationObservers[0].trigger());
    expect(host.textContent).toBe('640x360');
    act(() => root.unmount());
    expect(resizeObservers[0].disconnected).toBe(true);
    expect(mutationObservers[0].disconnected).toBe(true);
    host.remove();
    frame.remove();
  });
});

interface MockObserver {
  target?: Element;
  disconnected: boolean;
  callback?: () => void;
  observe(target: Element): void;
  disconnect(): void;
  trigger(): void;
}
