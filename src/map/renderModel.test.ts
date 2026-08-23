import { describe, expect, it } from 'vitest';
import {
  generatedInset,
  generatedLocations,
  generatedMap,
} from '../contracts/generatedData';
import { mapLayerForLocation } from '../quizMapBoundary';
import { buildMapRenderModel } from './renderModel';

describe('map render model', () => {
  it.each([
    ['wide', 1440, 720],
    ['mobile', 320, 180],
  ])(
    'preserves ordinary path ordering at %s viewport',
    (_name, width, height) => {
      const active = generatedLocations[0];
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
      expect(model.projection.transform).toBeDefined();
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
    expect(model.insetContextPathCopies).toEqual([]);
    expect(model.callout).toBeDefined();
    expect(model.positionedCallout).toBeDefined();
  });
});
