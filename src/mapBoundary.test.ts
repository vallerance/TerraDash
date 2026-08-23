import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const mapSources = ['MapView.tsx', 'MapCanvas.tsx', 'MapCallout.tsx', 'renderModel.ts', 'useMapViewport.ts'];

describe('map extraction boundaries', () => {
  it('keeps map modules independent of page and gameplay ownership', () => {
    for (const name of mapSources) {
      const source = readFileSync(new URL(`./map/${name}`, import.meta.url), 'utf8');
      expect(source).not.toMatch(/from ['"].*\/(main|QuizPlayer|QuizContext|highScores|storage|scoring)/);
      expect(source).not.toMatch(/data\/generated|data\/quizzes\.json/);
    }
  });

  it('keeps viewport observers scoped to their distinct DOM responsibilities', () => {
    const mapViewport = readFileSync(new URL('./map/useMapViewport.ts', import.meta.url), 'utf8');
    const shell = readFileSync(new URL('./MapBoxShell.tsx', import.meta.url), 'utf8');
    expect(mapViewport).toContain("querySelector('.map-frame')");
    expect(mapViewport).toContain('observer?.observe(frame)');
    expect(mapViewport).toContain('observer?.disconnect()');
    expect(shell).toContain("localRef.current");
    expect(shell).toContain('observer?.observe(stage)');
    expect(shell).toContain('observer?.disconnect()');
  });
});
