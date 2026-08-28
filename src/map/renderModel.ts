import {
  deriveCalloutModel,
  deriveCalloutLayout,
  calloutLeaderLines,
  MAP_OVERLAP_REFERENCE_UNITS,
  mapXForLongitude,
  sharedInsetViewBox,
  wrappedOffsets,
  wrappedPointPositions,
  wrappedPathOffsets,
  wrappedViewportBounds,
  type ViewportBounds,
} from '../footprint';
import {
  insetGeometryPaths,
  selectedInsetGeometryPaths,
  tinyInsetDot,
} from '../mapGeometry';
import { createMapProjection } from '../mapProjection';
import type {
  GeneratedContext,
  GeneratedInset,
  GeneratedMap,
  GeneratedLocation,
} from '../contracts/generatedData';
import type { MapLayer } from '../quizMapBoundary';

type MapInputs = {
  layer: MapLayer;
  map: GeneratedMap;
  context?: GeneratedContext;
  inset: GeneratedInset;
};

function parseViewportBounds(viewBox: string): ViewportBounds | undefined {
  const values = viewBox.trim().split(/\s+/).map(Number);
  return values.length === 4 && values.every(Number.isFinite)
    ? [values[0]!, values[0]! + values[2]!, values[1]!, values[1]! + values[3]!]
    : undefined;
}

/** Geometry and coordinate data owned by the stable map-layer boundary. */
export function buildStaticMapRenderModel({
  layer,
  map,
  context,
  inset,
}: MapInputs) {
  const viewportBounds = parseViewportBounds(layer.viewBox);
  const projectionCenterY = viewportBounds
    ? (viewportBounds[2] + viewportBounds[3]) / 2
    : map.height / 2;
  const projection = createMapProjection(
    layer.standardParallel,
    projectionCenterY,
  );
  const seamX = mapXForLongitude(layer.seamLongitude, layer.wrapWidth);
  const renderedMapWidth = map.width + MAP_OVERLAP_REFERENCE_UNITS * 2;
  const [renderedMapStart] = viewportBounds
    ? viewportBounds
    : wrappedViewportBounds(layer.wrapWidth, seamX);
  const wrappedPathCopies = (paths: string[], width = layer.wrapWidth) =>
    paths.flatMap((path) =>
      wrappedPathOffsets(
        [path],
        width,
        seamX,
        MAP_OVERLAP_REFERENCE_UNITS,
        viewportBounds ? [viewportBounds[0], viewportBounds[1]] : undefined,
      ).map((transform) => ({ path, transform })),
    );
  const contextVariant = layer.contextDetail
    ? context?.variants.find(
        (variant) =>
          variant.source === layer.contextDetail?.source &&
          variant.tolerance === layer.contextDetail?.tolerance,
      )
    : undefined;
  const contextPathCopies = layer.contextFeatureIds.map((id) => ({
    id,
    paths: wrappedPathCopies(
      contextVariant?.features[id as keyof typeof contextVariant.features]
        ?.paths ?? map.features[id as keyof typeof map.features].paths,
    ),
  }));
  const baseLayerPathCopies = layer.baseLayers.map((baseLayer) => ({
    id: baseLayer.id,
    paths: wrappedPathCopies(baseLayer.paths),
  }));
  const wrappedInsetPathCopies = (paths: string[]) =>
    paths.flatMap((path) =>
      wrappedPathOffsets(
        [path],
        inset.width,
        seamX,
        MAP_OVERLAP_REFERENCE_UNITS,
        viewportBounds ? [viewportBounds[0], viewportBounds[1]] : undefined,
      ).map((transform) => ({ path, transform })),
    );
  const insetContextPathCopies = layer.baseLayers.map((baseLayer) => ({
    id: baseLayer.id,
    paths: wrappedInsetPathCopies(insetGeometryPaths(baseLayer.id)),
  }));
  const insetSourcePathCopies = inset.sourceFeatureIds.map((id) => ({
    id,
    paths: wrappedInsetPathCopies(
      inset.features[id as keyof typeof inset.features].paths,
    ),
  }));
  return {
    layer,
    map,
    inset,
    projection,
    viewportBounds,
    seamX,
    renderedMapStart,
    renderedMapWidth,
    contextPathCopies,
    baseLayerPathCopies,
    insetContextPathCopies,
    insetSourcePathCopies,
    wrappedPathCopies,
    wrappedInsetPathCopies,
  };
}

type StaticMapRenderModel = ReturnType<typeof buildStaticMapRenderModel>;

/** Active highlight and callout data owned by the dynamic overlay boundary. */
export function buildDynamicMapRenderModel({
  active,
  layer,
  staticModel,
  viewportWidth,
  viewportHeight,
}: {
  active: GeneratedLocation;
  layer: MapLayer;
  staticModel: StaticMapRenderModel;
  viewportWidth: number;
  viewportHeight: number;
}) {
  const {
    inset,
    projection,
    viewportBounds,
    seamX,
    wrappedPathCopies,
    wrappedInsetPathCopies,
  } = staticModel;
  const highlightedPaths = layer.activePaths;
  const insetSelectedPaths = selectedInsetGeometryPaths(
    active.id,
    active.geometryRefs,
  );
  const projectedHighlightedPaths = highlightedPaths.map(projection.path);
  const projectedInsetSelectedPaths = insetSelectedPaths.map((region) => ({
    ...region,
    path: projection.path(region.path),
    center: projection.point(region.center as [number, number]),
    span: projection.span(region.span as [number, number]),
  }));
  const coordinateViewportWidth = viewportBounds
    ? viewportBounds[1] - viewportBounds[0]
    : staticModel.renderedMapWidth;
  const scale = viewportWidth / coordinateViewportWidth;
  const callout = deriveCalloutModel(
    projectedHighlightedPaths,
    scale,
    layer.wrapWidth,
    undefined,
    undefined,
    seamX,
  );
  const sourceOffsets = callout
    ? wrappedOffsets(
        callout.sourceCenter[0],
        callout.sourceCenter[0],
        layer.wrapWidth,
        seamX,
        MAP_OVERLAP_REFERENCE_UNITS,
        viewportBounds ? [viewportBounds[0], viewportBounds[1]] : undefined,
      )
    : [];
  const sourceOffset =
    callout && sourceOffsets.length
      ? sourceOffsets.reduce(
          (best, offset) =>
            Math.abs(callout.sourceCenter[0] + offset - layer.wrapWidth / 2) <
            Math.abs(callout.sourceCenter[0] + best - layer.wrapWidth / 2)
              ? offset
              : best,
          sourceOffsets[0]!,
        )
      : 0;
  const displayedCallout = callout
    ? {
        ...callout,
        sourceCenter: [
          callout.sourceCenter[0] + sourceOffset,
          callout.sourceCenter[1],
        ] as [number, number],
        focusCenter: [
          (callout.focusCenter ?? callout.sourceCenter)[0] + sourceOffset,
          (callout.focusCenter ?? callout.sourceCenter)[1],
        ] as [number, number],
      }
    : undefined;
  const cutoutLayout = displayedCallout
    ? deriveCalloutLayout(
        displayedCallout,
        scale,
        layer.wrapWidth,
        viewportHeight / scale,
        viewportWidth,
        viewportBounds,
      )
    : undefined;
  const positionedCallout =
    displayedCallout && cutoutLayout
      ? { ...displayedCallout, sourceCenter: cutoutLayout.sourceCenter }
      : displayedCallout;
  const cutoutRadius = cutoutLayout?.radius ?? 0;
  const cutoutCenter = cutoutLayout?.center ?? [0, 0];
  const insetViewBox = sharedInsetViewBox(
    positionedCallout?.sourceCenter ?? [0, 0],
    cutoutLayout?.sourceRadius ?? 1,
  );
  const insetRenderedScale = cutoutLayout
    ? (cutoutRadius * scale) / cutoutLayout.sourceRadius
    : 0;
  const insetDot = tinyInsetDot(
    projectedInsetSelectedPaths,
    insetRenderedScale,
  );
  const insetDotCenter = insetDot
    ? wrappedPointPositions(
        insetDot.center,
        inset.width,
        seamX,
        MAP_OVERLAP_REFERENCE_UNITS,
        viewportBounds ? [viewportBounds[0], viewportBounds[1]] : undefined,
      ).reduce((best, point) =>
        Math.abs(point[0] - insetViewBox.x - insetViewBox.size / 2) <
        Math.abs(best[0] - insetViewBox.x - insetViewBox.size / 2)
          ? point
          : best,
      )
    : undefined;
  const leaderLines = displayedCallout
    ? calloutLeaderLines(
        positionedCallout!.sourceCenter,
        cutoutLayout!.sourceRadius,
        cutoutCenter,
        cutoutRadius,
      )
    : [];
  const activePathCopies = layer.wrapActive
    ? wrappedPathCopies(highlightedPaths)
    : highlightedPaths.map((path) => ({ path, transform: 0 }));
  const insetSelectedPathCopies = insetSelectedPaths.flatMap(
    ({ path, kind }, pathIndex) =>
      wrappedInsetPathCopies([path]).map(
        ({ path: wrappedPath, transform }, index) => ({
          path: wrappedPath,
          transform,
          kind,
          key: `${pathIndex}:${kind}:${transform}:${index}`,
        }),
      ),
  );
  return {
    active,
    layer,
    highlightedPaths,
    insetSelectedPaths,
    projectedInsetSelectedPaths,
    callout,
    displayedCallout,
    positionedCallout,
    cutoutLayout,
    cutoutRadius,
    cutoutCenter,
    insetViewBox,
    insetRenderedScale,
    insetDot,
    insetDotCenter,
    leaderLines,
    activePathCopies,
    insetSelectedPathCopies,
    clipId: `map-callout-clip-${active.id.replace(/[^a-z0-9]/gi, '-')}`,
  };
}

/** Compatibility aggregate for pure-model consumers and existing tests. */
export function buildMapRenderModel({
  active,
  layer,
  viewportWidth,
  viewportHeight,
  ...inputs
}: MapInputs & {
  active: GeneratedLocation;
  viewportWidth: number;
  viewportHeight: number;
}) {
  const staticModel = buildStaticMapRenderModel({ layer, ...inputs });
  return {
    ...staticModel,
    ...buildDynamicMapRenderModel({
      active,
      layer,
      staticModel,
      viewportWidth,
      viewportHeight,
    }),
  };
}
