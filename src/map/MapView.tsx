import { useMemo, useRef } from 'react';
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
  onStaticModelBuild,
}: {
  active: Location;
  layer: MapLayer;
  /** Test/evidence seam; called only when the semantic static contract rebuilds. */
  onStaticModelBuild?: (contractId: string) => void;
}) {
  const { width: viewportWidth, height: viewportHeight } = useMapViewport();
  const layerIdentity = mapLayerIdentity(layer);
  const staticModelBuildObserver = useRef(onStaticModelBuild);
  staticModelBuildObserver.current = onStaticModelBuild;
  const staticModel = useMemo(() => {
    staticModelBuildObserver.current?.(layerIdentity);
    return buildStaticMapRenderModel({ layer, map, context, inset });
  }, [layerIdentity]);
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
