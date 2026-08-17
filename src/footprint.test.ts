// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import catalog from '../data/generated/catalog.json';
import map from '../data/generated/map.json';
import {
  COMPONENT_CLUSTER_PROXIMITY_PX,
  CALLOUT_RADIUS_SCALE,
  CALLOUT_MAGNIFICATION_RATIO,
  CALLOUT_GAP_PX,
  calloutLeaderLines,
  calloutEdgeGapPx,
  deriveCalloutLayout,
  deriveCalloutModel,
  hasRenderableArea,
  pathArea,
  MIN_FOOTPRINT_PX,
  mapXForLongitude,
  MAP_OVERLAP_REFERENCE_UNITS,
  MAP_SEAM_LONGITUDE,
  pathPoints,
  pathPointComponents,
  sharedInsetViewBox,
  unwrapComponent,
  wrappedOffsets,
  wrappedViewportBounds,
} from './footprint';

function pathsFor(id: string) {
  const item = catalog.find((entry) => entry.id === id)!;
  return item.geometryRefs.flatMap(
    (ref) => map.features[ref as keyof typeof map.features].paths,
  );
}

describe('threshold and ring primitives', () => {
  it('retains the original 100-unit wrapped geometry band', () => {
    expect(MAP_OVERLAP_REFERENCE_UNITS).toBe(100);
    const seamX = mapXForLongitude(MAP_SEAM_LONGITUDE, 1440);
    const bounds = wrappedViewportBounds(1440, seamX);
    expect(bounds).toEqual([-412, 1228]);
    expect(bounds[1]).toBe(mapXForLongitude(127, 1440));
    expect(-seamX - bounds[0]).toBe(MAP_OVERLAP_REFERENCE_UNITS);
    expect(bounds[1] - (-seamX + 1440)).toBe(MAP_OVERLAP_REFERENCE_UNITS);
    expect(wrappedOffsets(1340, 1380, 1440, seamX)).toContain(-1752);
    expect(wrappedOffsets(60, 100, 1440, seamX)).toContain(1128);
  });

  it('uses the 25px linear boundary for newly routed callouts', () => {
    expect(
      deriveCalloutModel([`M0,0L${MIN_FOOTPRINT_PX - 0.01},0L0,1Z`], 1, 1440),
    ).toBeDefined();
    expect(
      deriveCalloutModel([`M0,0L${MIN_FOOTPRINT_PX},0L0,1Z`], 1, 1440),
    ).toBeUndefined();
  });

  it('keeps a dateline-spanning Fiji cluster local to its source copy', () => {
    const fiji = catalog.find((entry) => entry.id === 'iso:FJI')!;
    const model = deriveCalloutModel(
      fiji.geometryRefs.flatMap(
        (ref) => map.features[ref as keyof typeof map.features].paths,
      ),
      1,
      map.width,
    )!;
    expect(model.sourceCenter[0]).toBeGreaterThan(1400);
    expect(model.clusterBounds![2] - model.clusterBounds![0]).toBeLessThan(100);
  });

  it('classifies real projected paths without turning points into area', () => {
    expect(pathArea('M0,0L4,0L4,3L0,3Z')).toBe(12);
    expect(hasRenderableArea('M0,0L0,0Z')).toBe(false);
    expect(hasRenderableArea('M0,0L4,0L4,3L0,3Z')).toBe(true);
  });

  it('preserves each M/Z subpath as an independent ring', () => {
    expect(pathPointComponents('M0,0L2,0L2,2Z M40,0L42,0L42,2Z', 100)).toEqual([
      [
        [0, 0],
        [2, 0],
        [2, 2],
      ],
      [
        [40, 0],
        [42, 0],
        [42, 2],
      ],
    ]);
    expect(
      pathsFor('iso:ATG').flatMap((path) =>
        pathPointComponents(path, map.width),
      ),
    ).toHaveLength(2);
    expect(
      pathsFor('iso:ARM').flatMap((path) =>
        pathPointComponents(path, map.width),
      ),
    ).toHaveLength(3);
    expect(
      pathsFor('iso:UZB').flatMap((path) =>
        pathPointComponents(path, map.width),
      ),
    ).toHaveLength(4);
  });

  it('unwraps a ring crossing the world edge locally', () => {
    expect(
      unwrapComponent(
        [
          [1, 0],
          [1439, 1],
        ],
        1440,
      ),
    ).toEqual([
      [1441, 0],
      [1439, 1],
    ]);
  });
});

describe('callout selection and actual-boundary clustering', () => {
  it('uses one shared map-space circle extent for source and inset cardinal points', () => {
    const center: [number, number] = [1438, 90];
    const radius = 12.5;
    const viewBox = sharedInsetViewBox(center, radius);
    expect(viewBox).toEqual({ x: 1425.5, y: 77.5, size: 25 });
    expect([viewBox.x + viewBox.size / 2, viewBox.y]).toEqual([
      center[0],
      center[1] - radius,
    ]);
    expect([viewBox.x + viewBox.size, viewBox.y + viewBox.size / 2]).toEqual([
      center[0] + radius,
      center[1],
    ]);
  });

  it('keeps both leader endpoints on their circle boundaries', () => {
    const lines = calloutLeaderLines([10, 20], 8, [80, 20], 30);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(Math.hypot(line.x1 - 10, line.y1 - 20)).toBeCloseTo(8);
      expect(Math.hypot(line.x2 - 80, line.y2 - 20)).toBeCloseTo(30);
    }
  });

  it('doubles cutout area with a 72px source gap', () => {
    const layout = deriveCalloutLayout(
      { sourceCenter: [240, 180], selectedPathIndices: [0] },
      1,
      1440,
      720,
      1440,
    );
    expect(layout.radius).toBe(100 * CALLOUT_RADIUS_SCALE);
    expect(layout.sourceRadius).toBe(
      (100 * CALLOUT_RADIUS_SCALE) / CALLOUT_MAGNIFICATION_RATIO,
    );
    expect(layout.center[0]).toBeGreaterThan(240);
    expect(layout.center[0]).toBe(
      240 + layout.sourceRadius + 72 + 100 * CALLOUT_RADIUS_SCALE,
    );
    expect(layout.center[1]).toBe(180);
  });

  it('uses identical circle sizes and magnification for every region', () => {
    const layouts = [
      deriveCalloutModel(pathsFor('iso:ATG'), 0.25, map.width)!,
      deriveCalloutModel(pathsFor('iso:VAT'), 0.25, map.width)!,
      deriveCalloutModel(pathsFor('iso:FJI'), 0.25, map.width)!,
    ].map((model) =>
      deriveCalloutLayout(model, 0.25, map.width, map.height, 410),
    );
    expect(new Set(layouts.map(({ radius }) => radius)).size).toBe(1);
    expect(new Set(layouts.map(({ sourceRadius }) => sourceRadius)).size).toBe(
      1,
    );
    for (const layout of layouts)
      expect(layout.radius / layout.sourceRadius).toBe(
        CALLOUT_MAGNIFICATION_RATIO,
      );
  });

  it('keeps the source-to-cutout edge gap constant in rendered pixels', () => {
    const callout = {
      sourceCenter: [240, 180] as [number, number],
      selectedPathIndices: [0],
    };
    for (const scale of [1, 0.5, 358 / 1640, 954 / 1640]) {
      const layout = deriveCalloutLayout(
        callout,
        scale,
        1440,
        720,
        1440 * scale,
      );
      expect(
        calloutEdgeGapPx(
          callout.sourceCenter,
          layout.sourceRadius,
          layout.center,
          layout.radius,
          scale,
        ),
      ).toBeGreaterThanOrEqual(CALLOUT_GAP_PX);
      expect(
        calloutEdgeGapPx(
          callout.sourceCenter,
          layout.sourceRadius,
          layout.center,
          layout.radius,
          scale,
        ),
      ).toBeLessThanOrEqual(CALLOUT_GAP_PX + 1.5);
    }
  });

  it('keeps the gap when the map is reduced to a phone-sized scale', () => {
    const scale = 358 / 1640;
    const callout = {
      sourceCenter: [720, 360] as [number, number],
      selectedPathIndices: [0],
    };
    const layout = deriveCalloutLayout(callout, scale, 1440, 720, 358);
    expect(
      calloutEdgeGapPx(
        callout.sourceCenter,
        layout.sourceRadius,
        layout.center,
        layout.radius,
        scale,
      ),
    ).toBeCloseTo(CALLOUT_GAP_PX);
  });

  it('flips and clamps the cutout when the preferred side has no room', () => {
    const layout = deriveCalloutLayout(
      { sourceCenter: [1410, 40], selectedPathIndices: [0] },
      1,
      1440,
      720,
      390,
    );
    expect(layout.radius).toBeCloseTo(54.6 * CALLOUT_RADIUS_SCALE);
    expect(layout.center[0]).toBeLessThan(1410);
    expect(layout.center[1]).toBeGreaterThanOrEqual(
      54.6 * CALLOUT_RADIUS_SCALE + 24,
    );
    expect(layout.center[1]).toBeLessThanOrEqual(
      720 - 54.6 * CALLOUT_RADIUS_SCALE - 24,
    );
  });

  it.each(['iso:ATG', 'iso:ARM'])('selects one callout for %s', (id) => {
    const model = deriveCalloutModel(
      pathsFor(id),
      0.25,
      map.width,
      10,
      24,
      mapXForLongitude(MAP_SEAM_LONGITUDE, map.width),
    );
    expect(model).toBeDefined();
    expect(model?.selectedPathIndices.length).toBeGreaterThan(0);
  });

  it('bypasses callout behavior when any real region is large', () => {
    expect(
      deriveCalloutModel(pathsFor('iso:UZB'), 1, map.width),
    ).toBeUndefined();
  });

  it('selects only the largest region cluster and ignores disconnected fragments', () => {
    const model = deriveCalloutModel(
      ['M0,0L2,0L2,2L0,2Z', 'M8,0L10,0L10,2L8,2Z', 'M100,0L102,0L102,2L100,2Z'],
      1,
      1440,
      10,
      COMPONENT_CLUSTER_PROXIMITY_PX,
    );
    expect(model?.selectedPathIndices).toEqual([0, 1]);
    expect(model?.sourceCenter[0]).toBe(5);
  });

  it('does not use overlapping boxes as a proximity proof', () => {
    const result = deriveCalloutModel(
      ['M0,0L20,0L20,20L0,20Z', 'M19,30L39,30L39,50L19,50Z'],
      1,
      1440,
      10,
      24,
    );
    expect(result).toBeUndefined();
  });

  it('clusters true boundary neighbors and supports seam copies', () => {
    expect(
      deriveCalloutModel(['M0,0L2,0L2,2L0,2Z', 'M3,0L5,0L5,2L3,2Z'], 1, 1440)
        ?.selectedPathIndices,
    ).toEqual([0, 1]);
    expect(wrappedOffsets(1438, 1442, 1440, 40)).toContain(-1480);
  });

  it('supports degenerate point geometry deterministically', () => {
    const first = deriveCalloutModel(
      ['M10,10L10,10Z', 'M20,10L20,10Z'],
      1,
      1440,
    );
    const second = deriveCalloutModel(
      ['M10,10L10,10Z', 'M20,10L20,10Z'],
      1,
      1440,
    );
    expect(first).toEqual(second);
  });

  it('retains the original paths and one semantic geometry source', () => {
    const paths = pathsFor('iso:ATG');
    expect(pathPoints(paths).length).toBeGreaterThan(0);
    expect(paths).toEqual(pathsFor('iso:ATG'));
  });
});
