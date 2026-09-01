import type { GeneratedInset } from '../contracts/generatedData';
import type { LocationKind } from './locationSemantics';
import type {
  buildDynamicMapRenderModel,
  buildStaticMapRenderModel,
} from './renderModel';

type DynamicModel = ReturnType<typeof buildDynamicMapRenderModel>;
type StaticModel = ReturnType<typeof buildStaticMapRenderModel>;

type MapCalloutProps = Pick<
  DynamicModel,
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
  | 'insetSelectedPathCopies'
  | 'clipId'
> & {
  inset: GeneratedInset;
  insetContextPathCopies: StaticModel['insetContextPathCopies'];
  insetSourcePathCopies: StaticModel['insetSourcePathCopies'];
  projection: StaticModel['projection'];
  locationKind: LocationKind;
};

export function MapCallout({
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
  insetContextPathCopies,
  insetSelectedPathCopies,
  insetSourcePathCopies,
  projection,
  clipId,
  locationKind,
}: MapCalloutProps) {
  return callout && positionedCallout ? (
    <g className="map-callout" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <circle cx={cutoutCenter[0]} cy={cutoutCenter[1]} r={cutoutRadius} />
        </clipPath>
      </defs>
      <g className="callout-inset-clip" clipPath={`url(#${clipId})`}>
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
            {insetSourcePathCopies.map(({ id, paths }) => (
              <g key={id} className="country">
                {paths.map(({ path, transform }, index) => (
                  <path
                    key={`${id}:${transform}:${index}`}
                    d={path}
                    transform={`translate(${transform} 0)`}
                  />
                ))}
              </g>
            ))}
            {insetContextPathCopies.length > 0 && (
              <g className="callout-context">
                {insetContextPathCopies.map((baseLayer) => (
                  <g
                    key={baseLayer.id}
                    className="country"
                    data-layer-id={baseLayer.id}
                  >
                    {baseLayer.paths.map(({ path, transform }, index) => (
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
            <g className={`callout-selected ${locationKind}-location`}>
              {insetSelectedPathCopies.map(
                ({ path: wrappedPath, transform, kind, key }) => (
                  <path
                    key={key}
                    className={`inset-selected-${kind}`}
                    d={wrappedPath}
                    transform={`translate(${transform} 0)`}
                    fillRule="evenodd"
                  />
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
  ) : null;
}
