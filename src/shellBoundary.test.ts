import { describe, expect, it } from 'vitest';

const sourceModules = import.meta.glob('./**/*.{ts,tsx}', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

describe('Phase 3 ownership boundaries', () => {
  it('keeps the browser entrypoint out of runtime/shared imports', () => {
    const forbidden = Object.entries(sourceModules)
      .filter(
        ([path]) =>
          !path.endsWith('main.tsx') &&
          !path.endsWith('.test.ts') &&
          !path.endsWith('.test.tsx'),
      )
      .filter(([, source]) => /from ['"][^'"]*\/main['"]/.test(source));
    expect(forbidden).toEqual([]);
  });

  it('keeps routing and shell free of raw data, map internals, scoring, storage, and gameplay imports', () => {
    const forbidden = Object.entries(sourceModules)
      .filter(
        ([path]) =>
          path.startsWith('./routing/') || path.startsWith('./shell/'),
      )
      .filter(([, source]) =>
        /data\/generated|data\/quizzes\.json|mapGeometry|from ['"][^'"]*(scoring|highScores|QuizPlayer|quizEngine|map\/)/.test(
          source,
        ),
      );
    expect(forbidden).toEqual([]);
  });

  it('has one source owner for history mutation and subscription', () => {
    const historyOwners = Object.entries(sourceModules).filter(([, source]) =>
      /pushState|replaceState|addEventListener\(['"]popstate/.test(source),
    );
    expect(historyOwners.map(([path]) => path)).toEqual([
      './routing/browserHistory.ts',
    ]);
  });

  it('keeps QuizPlayer selection state-free', () => {
    expect(sourceModules['./QuizPlayer.tsx']).not.toMatch(
      /useState<\s*QuizOption/,
    );
    expect(sourceModules['./QuizPlayer.tsx']).not.toMatch(
      /selectedQuizOption\s*=/,
    );
  });
});
