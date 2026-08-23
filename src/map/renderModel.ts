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
  GeneratedInset,
  GeneratedMap,
  GeneratedLocation,
} from '../contracts/generatedData';
import type { MapLayer } from '../quizMapBoundary';

export function buildMapRenderModel({
  active,
  layer,
  map,
  inset,
  viewportWidth,
  viewportHeight,
}: {
  active: GeneratedLocation;
  layer: MapLayer;
  map: GeneratedMap;
  inset: GeneratedInset;
  viewportWidth: number;
  viewportHeight: number;
}) {
  const highlightedPaths = layer.activePaths;
  const insetSelectedPaths = selectedInsetGeometryPaths(
    active.id,
    active.geometryRefs,
  );
  const parsedViewBox = layer.viewBox.trim().split(/\s+/).map(Number);
  const viewportBounds: ViewportBounds | undefined =
    parsedViewBox.length === 4 && parsedViewBox.every(Number.isFinite)
      ? [
          parsedViewBox[0],
          parsedViewBox[0] + parsedViewBox[2],
          parsedViewBox[1],
          parsedViewBox[1] + parsedViewBox[3],
        ]
      : undefined;
  const projectionCenterY = viewportBounds
    ? (viewportBounds[2] + viewportBounds[3]) / 2
    : map.height / 2;
  const projection = createMapProjection(
    layer.standardParallel,
    projectionCenterY,
  );
  const projectedHighlightedPaths = highlightedPaths.map(projection.path);
  const projectedInsetSelectedPaths = insetSelectedPaths.map((region) => ({
    ...region,
    path: projection.path(region.path),
    center: projection.point(region.center as [number, number]),
    span: projection.span(region.span as [number, number]),
  }));
  const seamX = mapXForLongitude(layer.seamLongitude, layer.wrapWidth);
  const renderedMapWidth = map.width + MAP_OVERLAP_REFERENCE_UNITS * 2;
  const [renderedMapStart, renderedMapEnd] = viewportBounds
    ? viewportBounds
    : wrappedViewportBounds(layer.wrapWidth, seamX);
  const coordinateViewportWidth = renderedMapEnd - renderedMapStart;
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
          sourceOffsets[0],
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
  const insetDot = tinyInsetDot(projectedInsetSelectedPaths, insetRenderedScale);
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
  const activePathCopies = layer.wrapActive
    ? wrappedPathCopies(highlightedPaths)
    : highlightedPaths.map((path) => ({ path, transform: 0 }));
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
  return {
    active,
    layer,
    map,
    inset,
    projection,
    viewportBounds,
    renderedMapStart,
    renderedMapWidth,
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
    wrappedPathCopies,
    wrappedInsetPathCopies,
    insetGeometryPaths,
  };
}
