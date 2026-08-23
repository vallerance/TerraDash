import { useMapViewport } from './useMapViewport';
import {
  generatedInset as inset,
  generatedMap as map,
  type GeneratedLocation,
} from '../contracts/generatedData';
import { buildMapRenderModel } from './renderModel';
import {
  mapLayerForLocation,
  type MapLayer,
  type RenderLocation,
} from '../quizMapBoundary';
import { MapCanvas } from './MapCanvas';

type Location = GeneratedLocation;

export function MapView({
  active,
  layer,
}: {
  active: Location;
  layer: MapLayer;
}) {
  const { width: viewportWidth, height: viewportHeight } = useMapViewport();
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

export function DiagnosticsMap({ location }: { location: RenderLocation }) {
  return <MapView active={location} layer={mapLayerForLocation(location)} />;
}
