import { useEffect, useState } from 'react';
import { generatedMap } from '../contracts/generatedData';

export type MapViewport = { width: number; height: number };

/**
 * Owns the map-frame viewport observer. MapBoxShell separately observes its
 * stage only for the CSS --map-width shell variable.
 */
export function useMapViewport(): MapViewport {
  const [viewport, setViewport] = useState<MapViewport>({
    width: generatedMap.width,
    height: generatedMap.height,
  });

  useEffect(() => {
    const frame = document.querySelector('.map-frame');
    if (!frame) return;
    const update = () => {
      const bounds = frame.getBoundingClientRect();
      setViewport({
        width: bounds.width || generatedMap.width,
        height: bounds.height || generatedMap.height,
      });
    };
    update();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(update);
    observer?.observe(frame);
    const mutations =
      typeof MutationObserver === 'undefined'
        ? undefined
        : new MutationObserver(update);
    mutations?.observe(frame.parentElement ?? frame, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class', 'style', 'transform'],
    });
    return () => {
      observer?.disconnect();
      mutations?.disconnect();
    };
  }, []);

  return viewport;
}
