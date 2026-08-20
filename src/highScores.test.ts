// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  HIGH_SCORES_STORAGE_KEY,
  getHighScores,
  getPlayerName,
  recordHighScore,
  updateHighScoreName,
} from './highScores';

describe('browser-local high scores', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        clear: () => values.clear(),
      },
    });
    window.localStorage.clear();
  });

  it('defaults the player name and keeps only the deterministic top five', () => {
    expect(getPlayerName()).toBe('Player 1');
    for (let index = 0; index < 6; index += 1)
      recordHighScore('world', index, 10_000, index);
    expect(getHighScores('world').map((entry) => entry.score)).toEqual([
      5, 4, 3, 2, 1,
    ]);
  });

  it('uses elapsed time and then creation order to resolve equal scores', () => {
    recordHighScore('world', 100, 2_000, 2);
    recordHighScore('world', 100, 1_000, 1);
    recordHighScore('world', 100, 1_000, 3);
    expect(getHighScores('world').map((entry) => entry.createdAt)).toEqual([
      1, 3, 2,
    ]);
  });

  it('qualifies an equal-score boundary entry only when its deterministic rank is top five', () => {
    for (let index = 0; index < 5; index += 1)
      recordHighScore('world', 100, 1_000, index);
    const slower = recordHighScore('world', 100, 2_000, 10);
    const faster = recordHighScore('world', 100, 500, 11);
    expect(slower.qualifies).toBe(false);
    expect(faster.qualifies).toBe(true);
    expect(getHighScores('world')).toHaveLength(5);
  });

  it('recovers from malformed or unsupported-version storage', () => {
    window.localStorage.setItem(HIGH_SCORES_STORAGE_KEY, '{not-json');
    expect(getHighScores('world')).toEqual([]);
    window.localStorage.setItem(
      HIGH_SCORES_STORAGE_KEY,
      JSON.stringify({ version: 99, scores: { world: [{ score: 999 }] } }),
    );
    expect(getHighScores('world')).toEqual([]);
  });

  it('updates the just-created entry and the default for future entries', () => {
    const first = recordHighScore('world', 10, 1_000, 1);
    updateHighScoreName('world', first.entry.id, 'Explorer');
    expect(getHighScores('world')[0].username).toBe('Explorer');
    expect(recordHighScore('asia', 10, 1_000, 2).entry.username).toBe(
      'Explorer',
    );
  });
});
