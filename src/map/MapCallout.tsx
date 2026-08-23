import type { GeneratedInset } from '../contracts/generatedData';
import { insetGeometryPaths } from '../mapGeometry';
import type { MapLayer } from '../quizMapBoundary';
import type { buildMapRenderModel } from './renderModel';

type RenderModel = ReturnType<typeof buildMapRenderModel>;

type MapCalloutProps = Pick<RenderModel,
  | 'callout'
  | 'positionedCallout'
  | 'cutoutLayout'
  | 'cutoutRadius'
  | 'cutoutCenter'
  | 'insetViewBox'
  | 'insetRenderedScale'
  | 'insetDot'
  | 'insetDotCenter'
  | 'leaderLines'
  | 'insetSelectedPaths'
  | 'wrappedInsetPathCopies'
> & {
  active: RenderModel['active'];
  layer: MapLayer;
  inset: GeneratedInset;
};

export function MapCallout({
  active,
  layer,
  inset,
  callout,
  positionedCallout,
  cutoutLayout,
  cutoutRadius,
  cutoutCenter,
  insetViewBox,
  insetRenderedScale,
  insetDot,
  insetDotCenter,
  leaderLines,
  insetSelectedPaths,
  wrappedInsetPathCopies,
}: MapCalloutProps) {
  return callout && positionedCallout ? (
  <g className="map-callout" aria-hidden="true">
    <defs>
      <clipPath
        id={`map-callout-clip-${active.id.replace(/[^a-z0-9]/gi, '-')}`}
      >
        <circle
          cx={cutoutCenter[0]}
          cy={cutoutCenter[1]}
          r={cutoutRadius}
        />
      </clipPath>
    </defs>
    <g
      className="callout-inset-clip"
      clipPath={`url(#map-callout-clip-${active.id.replace(/[^a-z0-9]/gi, '-')})`}
    >
      <svg
        className="callout-inset"
        x={cutoutCenter[0] - cutoutRadius}
        y={cutoutCenter[1] - cutoutRadius}
        width={cutoutRadius * 2}
        height={cutoutRadius * 2}
        viewBox={`${insetViewBox.x} ${insetViewBox.y} ${insetViewBox.size} ${insetViewBox.size}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <rect
          className="callout-inset-ocean"
          x={insetViewBox.x}
          y={insetViewBox.y}
          width={insetViewBox.size}
          height={insetViewBox.size}
        />
        <g
          className="callout-inset-projection"
          transform={projection.transform}
        >
          {inset.sourceFeatureIds.map((id) => {
            const feature =
              inset.features[id as keyof typeof inset.features];
            return (
              <g key={id} className="country">
                {wrappedInsetPathCopies(feature.paths).map(
                  ({ path, transform }, index) => (
                    <path
                      key={`${id}:${transform}:${index}`}
                      d={path}
                      transform={`translate(${transform} 0)`}
                    />
                  ),
                )}
              </g>
            );
          })}
          {layer.baseLayers.length > 0 && (
            <g className="callout-context">
              {layer.baseLayers.map((baseLayer) => (
                <g
                  key={baseLayer.id}
                  className="country"
                  data-layer-id={baseLayer.id}
                >
                  {wrappedInsetPathCopies(
                    insetGeometryPaths(baseLayer.id),
                  ).map(({ path, transform }, index) => (
                    <path
                      key={`${baseLayer.id}:${transform}:${index}`}
                      d={path}
                      transform={`translate(${transform} 0)`}
                    />
                  ))}
                </g>
              ))}
            </g>
          )}
          <g className="callout-selected">
            {insetSelectedPaths.flatMap(({ path, kind }, pathIndex) =>
              wrappedInsetPathCopies([path]).map(
                ({ path: wrappedPath, transform }, index) => (
                  <path
                    key={`${pathIndex}:${kind}:${transform}:${index}`}
                    className={`inset-selected-${kind}`}
                    d={wrappedPath}
                    transform={`translate(${transform} 0)`}
                    fillRule="evenodd"
                  />
                ),
              ),
            )}
          </g>
        </g>
        {insetDot && insetDotCenter && (
          <g className="callout-selected">
            <circle
              className="inset-selected-dot"
              cx={insetDotCenter[0]}
              cy={insetDotCenter[1]}
              r={insetDot.diameter / 2 / insetRenderedScale}
            />
          </g>
        )}
      </svg>
    </g>
    <circle
      className="callout-cutout"
      cx={cutoutCenter[0]}
      cy={cutoutCenter[1]}
      r={cutoutRadius}
    />
    <circle
      className="callout-source"
      cx={positionedCallout!.sourceCenter[0]}
      cy={positionedCallout!.sourceCenter[1]}
      r={cutoutLayout!.sourceRadius}
    />
    {leaderLines.map((line, index) => (
      <line key={index} className="callout-leader" {...line} />
    ))}
  </g>
)}
  ) : null;
}
