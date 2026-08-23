import { useMapViewport } from './useMapViewport';
import {
  generatedInset as inset,
  generatedMap as map,
  type GeneratedLocation,
} from '../contracts/generatedData';
import { buildMapRenderModel } from './renderModel';
import type { MapLayer } from '../quizMapBoundary';
import { MapCanvas } from './MapCanvas';

type Location = GeneratedLocation;

export function MapView({
  active,
  layer,
}: {
  active: Location;
  layer: MapLayer;
}) {
  const { viewportWidth, viewportHeight } = useMapViewport();
  const model = buildMapRenderModel({
    active,
    layer,
    map,
    inset,
    viewportWidth,
    viewportHeight,
  });
  return <MapCanvas model={model} />;
}
