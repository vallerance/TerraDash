import { useMemo } from 'react';
import { useMapViewport } from './useMapViewport';
import {
  generatedInset as inset,
  generatedMap as map,
  generatedContext as context,
  type GeneratedLocation,
} from '../contracts/generatedData';
import {
  buildDynamicMapRenderModel,
  buildStaticMapRenderModel,
} from './renderModel';
import {
  mapLayerForLocation,
  mapLayerIdentity,
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
  const layerIdentity = mapLayerIdentity(layer);
  const staticModel = useMemo(
    () => buildStaticMapRenderModel({ layer, map, context, inset }),
    [layerIdentity],
  );
  const dynamicModel = useMemo(
    () =>
      buildDynamicMapRenderModel({
        active,
        layer,
        staticModel,
        viewportWidth,
        viewportHeight,
      }),
    [active, staticModel, viewportWidth, viewportHeight],
  );
  return <MapCanvas staticModel={staticModel} dynamicModel={dynamicModel} />;
}

export function DiagnosticsMap({ location }: { location: RenderLocation }) {
  return <MapView active={location} layer={mapLayerForLocation(location)} />;
}
