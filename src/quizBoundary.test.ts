import { describe, expect, it } from 'vitest';

const sourceModules = import.meta.glob('./**/*.{ts,tsx}', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

const runtimeSources = Object.entries(sourceModules).filter(
  ([path]) => !path.endsWith('.test.ts') && !path.endsWith('.test.tsx'),
);

describe('Phase 4 quiz ownership boundaries', () => {
  it('keeps QuizPlayer as a phase switch and compatibility facade', () => {
    const source = sourceModules['./QuizPlayer.tsx'];
    expect(source).toMatch(/state\.phase === 'idle'/);
    expect(source).toMatch(/state\.phase === 'completed'/);
    expect(source).toMatch(/QuizGameplay/);
    expect(source).toMatch(/QuizHome/);
    expect(source).toMatch(/QuizResults/);
    expect(source).not.toMatch(/className="player-card/);
    expect(source).not.toMatch(/<MapBoxShell/);
    expect(source).not.toMatch(
      /getHighScores|recordHighScore|updateHighScoreName/,
    );
  });

  it('confines high-score storage and browser console ownership to their leaves', () => {
    const extractedLeaves = runtimeSources.filter(
      ([path]) => path.startsWith('./quiz/') || path.startsWith('./results/'),
    );
    const scoreOwners = extractedLeaves
      .filter(([, source]) => /from ['"][^'\"]*\/highScores['"]/.test(source))
      .map(([path]) => path);
    expect(scoreOwners).toEqual(['./results/QuizResults.tsx']);

    const consoleOwners = extractedLeaves
      .filter(([, source]) => /window\.terraDash/.test(source))
      .map(([path]) => path);
    expect(consoleOwners).toEqual(['./quiz/QuizGameplay.tsx']);
  });

  it('keeps extracted leaves away from routing, shell, raw-data, and map owners', () => {
    const forbidden = runtimeSources
      .filter(([path]) => path.startsWith('./quiz/'))
      .filter(([, source]) =>
        /from ['"][^'\"]*(routing|browserHistory|AppShell|AppChrome|MapView|mapGeometry|generatedData|data\/generated|data\/quizzes)/.test(
          source,
        ),
      );
    expect(forbidden).toEqual([]);
  });
});
