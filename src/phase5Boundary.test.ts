import { describe, expect, it } from 'vitest';

const sourceModules = import.meta.glob('./**/*.{ts,tsx}', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

const runtimeSources = Object.entries(sourceModules).filter(
  ([path]) => !path.endsWith('.test.ts') && !path.endsWith('.test.tsx'),
);

describe('Phase 5 ownership boundaries', () => {
  it('keeps the High Scores storage read in the route page only', () => {
    const readers = runtimeSources
      .filter(([, source]) => /getAllHighScores\s*\(/.test(source))
      .filter(([path]) => path !== './highScores.ts')
      .map(([path]) => path);
    expect(readers).toEqual(['./pages/HighScoresPage.tsx']);
  });

  it('keeps the diagnostics route navigation adapter in RouterApp only', () => {
    const owners = runtimeSources
      .filter(([, source]) =>
        /encodeURIComponent\(locationId\)[\s\S]*replace:\s*true/.test(source),
      )
      .map(([path]) => path)
      .filter((path) => path !== './routing/browserHistory.ts');
    expect(owners).toEqual(['./routing/RouterApp.tsx']);
    expect(sourceModules['./diagnostics/DiagnosticsControl.tsx']).not.toMatch(
      /pushState|replaceState|navigate\s*\(/,
    );
  });

  it('keeps the high-score table free of storage effects', () => {
    expect(sourceModules['./high-scores/HighScoreTable.tsx']).not.toMatch(
      /getAllHighScores|getHighScores|recordHighScore|updateHighScoreName/,
    );
  });

  it('keeps completed-result effects in one dedicated results leaf', () => {
    const owners = runtimeSources
      .filter(([, source]) => /recordHighScore\s*\(/.test(source))
      .filter(([path]) => path !== './highScores.ts')
      .map(([path]) => path);
    expect(owners).toEqual(['./results/QuizResults.tsx']);
  });
});
