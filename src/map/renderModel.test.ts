import { describe, expect, it } from 'vitest';
import {
  generatedContext,
  generatedInset,
  generatedLocations,
  generatedMap,
} from '../contracts/generatedData';
import { quizOptions } from '../contracts/quiz';
import {
  deriveCalloutLayout,
  deriveCalloutModel,
  mapXForLongitude,
} from '../footprint';
import { createMapProjection } from '../mapProjection';
import { mapLayerForLocation, mapLayerForQuiz } from '../quizMapBoundary';
import { buildMapRenderModel } from './renderModel';

function parseViewBox(value: string): [number, number, number, number] {
  const parts = value.trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || !parts.every(Number.isFinite)) {
    throw new Error(`Invalid viewBox: ${value}`);
  }
  return [parts[0]!, parts[1]!, parts[2]!, parts[3]!];
}

describe('map render model', () => {
  it.each([
    ['wide', 1440, 720],
    ['mobile', 320, 180],
  ])(
    'preserves ordinary path ordering at %s viewport',
    (_name, width, height) => {
      const active = generatedLocations.find((location) =>
        location.id.startsWith('iso:'),
      );
      if (!active) throw new Error('An ordinary world location is missing');
      const layer = mapLayerForLocation(active);
      const model = buildMapRenderModel({
        active,
        layer,
        map: generatedMap,
        inset: generatedInset,
        viewportWidth: width,
        viewportHeight: height,
      });
      expect(model.activePathCopies.map(({ path }) => path)).toEqual(
        layer.activePaths,
      );
      expect(model.renderedMapWidth).toBe(generatedMap.width + 200);
      expect(model.projection.yScale).toBe(1);
    },
  );

  it('produces seam copies and high-resolution callout entries for MI', () => {
    const active = generatedLocations.find(
      (location) => location.id === 'US-MI',
    );
    if (!active) throw new Error('US-MI fixture is missing');
    const layer = mapLayerForLocation(active);
    const model = buildMapRenderModel({
      active,
      layer,
      map: generatedMap,
      inset: generatedInset,
      viewportWidth: 720,
      viewportHeight: 420,
    });
    expect(model.insetSelectedPathCopies.length).toBeGreaterThan(0);
    expect(model.insetSourcePathCopies.length).toBe(
      generatedInset.sourceFeatureIds.length,
    );
    expect(model.insetContextPathCopies.length).toBe(layer.baseLayers.length);
    expect(model.projectedInsetSelectedPaths.length).toBeGreaterThan(0);
  });

  it('keeps every mapped-quiz callout source inside its configured viewport', () => {
    for (const quiz of quizOptions.filter((candidate) => candidate.map)) {
      const mapConfig = quiz.map;
      if (!mapConfig) continue;
      const viewBoxValue = mapConfig.viewBox;
      if (!viewBoxValue) continue;
      const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] =
        parseViewBox(viewBoxValue);
      const viewportBounds: [number, number, number, number] = [
        viewBoxX,
        viewBoxX + viewBoxWidth,
        viewBoxY,
        viewBoxY + viewBoxHeight,
      ];
      const [minX, maxX, minY, maxY] = viewportBounds;
      const scale = 1309 / (maxX - minX);
      const projection = createMapProjection(
        mapConfig.standardParallel ?? 0,
        (minY + maxY) / 2,
      );
      for (const id of quiz.locationIds) {
        const active = generatedLocations.find(
          (location) => location.id === id,
        );
        if (!active) throw new Error(`Missing generated location ${id}`);
        const layer = mapLayerForQuiz(quiz, active);
        const callout = deriveCalloutModel(
          layer.activePaths.map(projection.path),
          scale,
          mapConfig.wrapWidth ?? 1440,
          undefined,
          undefined,
          mapXForLongitude(
            mapConfig.seamLongitude ?? 152,
            mapConfig.wrapWidth ?? 1440,
          ),
        );
        if (!callout) continue;
        const layout = deriveCalloutLayout(
          callout,
          scale,
          mapConfig.wrapWidth ?? 1440,
          573 / scale,
          1309,
          viewportBounds,
        );
        expect(layout.sourceCenter[0]).toBeGreaterThanOrEqual(minX);
        expect(layout.sourceCenter[0]).toBeLessThanOrEqual(maxX);
        expect(layout.sourceCenter[1]).toBeGreaterThanOrEqual(minY);
        expect(layout.sourceCenter[1]).toBeLessThanOrEqual(maxY);
      }
    }
  });

  it('selects configured high-detail context and falls back to 50m paths', () => {
    const mexico = quizOptions.find(({ id }) => id === 'mexican-states');
    const active = generatedLocations.find(({ id }) => id === 'MX-DIF');
    if (!mexico || !active)
      throw new Error('Mexico context fixture is missing');
    const regional = buildMapRenderModel({
      active,
      layer: mapLayerForQuiz(mexico, active),
      map: generatedMap,
      context: generatedContext,
      inset: generatedInset,
      viewportWidth: 1309,
      viewportHeight: 573,
    });
    const variant = generatedContext.variants.find(
      ({ source, tolerance }) => source === 'admin0-10m' && tolerance === 0.12,
    );
    expect(variant?.featureIds.length).toBeGreaterThan(4);
    const mexicoContext = regional.contextPathCopies.find(
      ({ id }) => id === 'ne:1159321055',
    );
    expect(mexicoContext?.paths[0]?.path).toBe(
      variant?.features['ne:1159321055']?.paths[0],
    );

    const world = generatedLocations.find(({ id }) => id === 'iso:MEX');
    if (!world) throw new Error('World Mexico fixture is missing');
    const fallback = buildMapRenderModel({
      active: world,
      layer: mapLayerForLocation(world),
      map: generatedMap,
      context: generatedContext,
      inset: generatedInset,
      viewportWidth: 1440,
      viewportHeight: 720,
    });
    expect(
      fallback.contextPathCopies.find(({ id }) => id === 'ne:1159321055')
        ?.paths[0]?.path,
    ).toBe(generatedMap.features['ne:1159321055']?.paths[0]);
  });

  it('covers every retained feature intersecting the configured regional viewport', () => {
    const mexico = quizOptions.find(({ id }) => id === 'mexican-states');
    const active = generatedLocations.find(({ id }) => id === 'MX-DIF');
    if (!mexico || !active || !mexico.map?.regionalDetail?.context)
      throw new Error('Mexico context fixture is missing');
    const [viewMinX, viewMinY, viewWidth, viewHeight] = parseViewBox(
      mexico.map.viewBox!,
    );
    const viewMaxX = viewMinX + viewWidth;
    const viewMaxY = viewMinY + viewHeight;
    const yScale = 1 / Math.cos((mexico.map.standardParallel! * Math.PI) / 180);
    const projectionCenterY = (viewMinY + viewMaxY) / 2;
    const projectedY = (value: number) =>
      projectionCenterY + (value - projectionCenterY) * yScale;
    const intersects = (featureId: string) => {
      const feature =
        generatedMap.features[featureId as keyof typeof generatedMap.features];
      if (!feature) throw new Error(`Missing context feature ${featureId}`);
      const [minX, minY, maxX, maxY] = feature.bounds;
      const projectedMinY = Math.min(minY, projectedY(minY), projectedY(maxY));
      const projectedMaxY = Math.max(maxY, projectedY(minY), projectedY(maxY));
      if (projectedMaxY < viewMinY || projectedMinY > viewMaxY) return false;
      return [-1440, 0, 1440].some(
        (offset) => maxX + offset >= viewMinX && minX + offset <= viewMaxX,
      );
    };
    const exclusions = new Set(mexico.map.contextFeatureExclusions ?? []);
    const expected = generatedMap.sourceFeatureIds.filter(
      (id) => !exclusions.has(id) && intersects(id),
    );
    const variant = generatedContext.variants.find(
      ({ source, tolerance }) =>
        source === mexico.map!.regionalDetail!.context!.source &&
        tolerance === mexico.map!.regionalDetail!.context!.tolerance,
    );
    expect(variant).toBeDefined();
    expect(expected.every((id) => variant?.featureIds.includes(id))).toBe(true);
    expect(expected.length).toBeGreaterThan(4);

    const model = buildMapRenderModel({
      active,
      layer: mapLayerForQuiz(mexico, active),
      map: generatedMap,
      context: generatedContext,
      inset: generatedInset,
      viewportWidth: 1309,
      viewportHeight: 573,
    });
    for (const id of expected) {
      const renderedPaths = model.contextPathCopies
        .find(({ id: renderedId }) => renderedId === id)
        ?.paths.map(({ path }) => path);
      const configuredPaths = new Set(
        variant?.features[id as keyof typeof variant.features]?.paths,
      );
      expect(renderedPaths?.length).toBeGreaterThan(0);
      expect(renderedPaths?.every((path) => configuredPaths.has(path))).toBe(
        true,
      );
    }
  });

  it('frames all provinces and retained northern territory context at target sizes', () => {
    const canada = quizOptions.find(({ id }) => id === 'canadian-provinces');
    if (!canada?.map) throw new Error('Canada quiz fixture is missing');
    const viewBox = parseViewBox(canada.map.viewBox!);
    const viewport: [number, number, number, number] = [
      viewBox[0],
      viewBox[0] + viewBox[2],
      viewBox[1],
      viewBox[1] + viewBox[3],
    ];
    const contains = (bounds: readonly number[]) =>
      bounds[0] >= viewport[0] &&
      bounds[2] <= viewport[1] &&
      bounds[1] >= viewport[2] &&
      bounds[3] <= viewport[3];

    for (const id of canada.locationIds) {
      const location = generatedLocations.find(
        (candidate) => candidate.id === id,
      );
      if (!location) throw new Error(`Missing Canadian province ${id}`);
      expect(contains(location.bounds)).toBe(true);
    }

    // The parent Canada feature is retained context, carrying Yukon,
    // Northwest Territories, Nunavut, and their multipart/island geometry.
    const northernContextId = 'ne:1159320467';
    const northernContext =
      generatedMap.features[
        northernContextId as keyof typeof generatedMap.features
      ];
    expect(contains(northernContext.bounds)).toBe(true);
    expect(northernContext.paths.length).toBeGreaterThan(1);

    for (const [width, height] of [
      [1309, 573],
      [768, 432],
      [320, 180],
    ] as const) {
      const active = generatedLocations.find(
        (location) => location.id === 'CA-BC',
      )!;
      const model = buildMapRenderModel({
        active,
        layer: mapLayerForQuiz(canada, active),
        map: generatedMap,
        context: generatedContext,
        inset: generatedInset,
        viewportWidth: width,
        viewportHeight: height,
      });
      const context = model.contextPathCopies.find(
        ({ id }) => id === northernContextId,
      );
      expect(context?.paths.length).toBeGreaterThan(1);
      const renderedHeight = Math.min(
        width / (viewBox[2] / viewBox[3]),
        height,
      );
      const verticalGutter = (height - renderedHeight) / 2;
      expect(verticalGutter).toBeGreaterThanOrEqual(0);
      expect(verticalGutter).toBeLessThan(48);
    }
  });
});
