import { memo } from 'react';
import { MapCallout } from './MapCallout';
import type {
  buildDynamicMapRenderModel,
  buildStaticMapRenderModel,
} from './renderModel';

type StaticModel = ReturnType<typeof buildStaticMapRenderModel>;
type DynamicModel = ReturnType<typeof buildDynamicMapRenderModel>;

export const StaticMapGeometry = memo(function StaticMapGeometry({
  model,
}: {
  model: StaticModel;
}) {
  const {
    layer,
    map,
    projection,
    renderedMapStart,
    renderedMapWidth,
    contextPathCopies,
    baseLayerPathCopies,
  } = model;
  return (
    <>
      <rect
        x={renderedMapStart}
        width={renderedMapWidth}
        height={map.height}
        className="ocean"
      />
      <g className="map-projection" transform={projection.transform}>
        <g className="countries">
          {contextPathCopies.map(({ id, paths }) => (
            <g
              key={id}
              data-feature-id={id}
              aria-hidden="true"
              className="country"
            >
              {paths.map(({ path, transform }, index) => (
                <path
                  key={`${transform}:${index}`}
                  d={path}
                  transform={`translate(${transform} 0)`}
                />
              ))}
            </g>
          ))}
        </g>
        {layer.baseLayers.length > 0 && (
          <g className="map-base-layers" aria-hidden="true">
            {baseLayerPathCopies.map((baseLayer) => (
              <g key={baseLayer.id} data-layer-id={baseLayer.id}>
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
      </g>
    </>
  );
});

export function MapOverlays({
  staticModel,
  model,
}: {
  staticModel: StaticModel;
  model: DynamicModel;
}) {
  const { projection, inset, insetContextPathCopies, insetSourcePathCopies } =
    staticModel;
  const { active, activePathCopies, layer } = model;
  return (
    <>
      <g className="map-projection-overlay" transform={projection.transform}>
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
        inset={inset}
        {...model}
        insetContextPathCopies={insetContextPathCopies}
        insetSourcePathCopies={insetSourcePathCopies}
        projection={projection}
      />
    </>
  );
}

export function MapCanvas({
  staticModel,
  dynamicModel,
}: {
  staticModel: StaticModel;
  dynamicModel: DynamicModel;
}) {
  const { layer, map, renderedMapStart, renderedMapWidth } = staticModel;
  return (
    <svg
      className="world-map"
      viewBox={
        layer.viewBox ||
        `${renderedMapStart} 0 ${renderedMapWidth} ${map.height}`
      }
      preserveAspectRatio={layer.preserveAspectRatio}
      data-map-contract-id={layer.geometryContractId}
      role="img"
      aria-label="Flat world map with the selected location highlighted"
    >
      <StaticMapGeometry model={staticModel} />
      <MapOverlays staticModel={staticModel} model={dynamicModel} />
    </svg>
  );
}
