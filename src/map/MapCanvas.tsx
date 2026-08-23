import { MapCallout } from './MapCallout';
import type { buildMapRenderModel } from './renderModel';

type RenderModel = ReturnType<typeof buildMapRenderModel>;

export function MapCanvas({ model }: { model: RenderModel }) {
  const {
    active,
    layer,
    map,
    inset,
    projection,
    renderedMapStart,
    renderedMapWidth,
    insetSelectedPaths,
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
    activePathCopies,
    wrappedPathCopies,
    wrappedInsetPathCopies,
    insetGeometryPaths,
  } = model;
  return (
    <svg
      className="world-map"
      viewBox={
        layer.viewBox ||
        `${renderedMapStart} 0 ${renderedMapWidth} ${map.height}`
      }
      preserveAspectRatio={layer.preserveAspectRatio}
      role="img"
      aria-label="Flat world map with the selected location highlighted"
    >
      <rect
        x={renderedMapStart}
        width={renderedMapWidth}
        height={map.height}
        className="ocean"
      />
      <g className="map-projection" transform={projection.transform}>
        <g className="countries">
          {layer.contextFeatureIds.map((id) => {
            const feature = map.features[id as keyof typeof map.features];
            const copies = wrappedPathCopies(feature.paths);
            return (
              <g
                key={id}
                data-feature-id={id}
                aria-hidden="true"
                className={
                  active.geometryRefs.includes(id)
                    ? 'country active'
                    : 'country'
                }
              >
                {copies.map(({ path, transform }, index) => (
                  <path
                    key={`${transform}:${index}`}
                    d={path}
                    transform={`translate(${transform} 0)`}
                  />
                ))}
              </g>
            );
          })}
        </g>
        {layer.baseLayers.length > 0 && (
          <g className="map-base-layers" aria-hidden="true">
            {layer.baseLayers.map((baseLayer) => (
              <g key={baseLayer.id} data-layer-id={baseLayer.id}>
                {wrappedPathCopies(baseLayer.paths).map(
                  ({ path, transform }, index) => (
                    <path
                      key={`${baseLayer.id}:${transform}:${index}`}
                      d={path}
                      transform={`translate(${transform} 0)`}
                    />
                  ),
                )}
              </g>
            ))}
          </g>
        )}
        <g
          className="active-fill"
          aria-hidden={layer.selectable ? undefined : true}
        >
          {activePathCopies.map(({ path, transform }, index) => (
            <path
              key={`${transform}:${index}`}
              d={path}
              transform={`translate(${transform} 0)`}
              data-location-id={layer.selectable ? active.id : undefined}
              role={layer.selectable ? 'button' : undefined}
              tabIndex={layer.selectable ? 0 : undefined}
              aria-label={layer.selectable ? active.name : undefined}
            />
          ))}
        </g>
        <g className="active-outline" aria-hidden="true">
          {activePathCopies.map(({ path, transform }, index) => (
            <path
              key={`${transform}:${index}`}
              d={path}
              transform={`translate(${transform} 0)`}
            />
          ))}
        </g>
      </g>
      <MapCallout
        active={active}
        layer={layer}
        inset={inset}
        callout={callout}
        positionedCallout={positionedCallout}
        cutoutLayout={cutoutLayout}
        cutoutRadius={cutoutRadius}
        cutoutCenter={cutoutCenter}
        insetViewBox={insetViewBox}
        insetRenderedScale={insetRenderedScale}
        insetDot={insetDot}
        insetDotCenter={insetDotCenter}
        leaderLines={leaderLines}
        insetSelectedPaths={insetSelectedPaths}
        wrappedInsetPathCopies={wrappedInsetPathCopies}
      />
    </svg>
 
  );
}
