export const HIGH_SCORES_STORAGE_KEY = 'terradash.high-scores.v1';
const MAX_SCORES = 5;
const DEFAULT_PLAYER_NAME = 'Player 1';

export type HighScoreEntry = {
  id: string;
  username: string;
  score: number;
  elapsedMs: number;
  createdAt: number;
};

type StoredHighScores = {
  version: 1;
  playerName: string;
  scores: Record<string, HighScoreEntry[]>;
};

export function compareHighScores(
  a: HighScoreEntry,
  b: HighScoreEntry,
): number {
  return (
    b.score - a.score ||
    a.elapsedMs - b.elapsedMs ||
    a.createdAt - b.createdAt ||
    a.id.localeCompare(b.id)
  );
}

function emptyStore(): StoredHighScores {
  return { version: 1, playerName: DEFAULT_PLAYER_NAME, scores: {} };
}

function isEntry(value: unknown): value is HighScoreEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<HighScoreEntry>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.username === 'string' &&
    Number.isFinite(entry.score) &&
    Number.isFinite(entry.elapsedMs) &&
    Number.isFinite(entry.createdAt)
  );
}

function readStore(): StoredHighScores {
  if (typeof window === 'undefined') return emptyStore();
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(HIGH_SCORES_STORAGE_KEY) ?? 'null',
    );
    if (!parsed || typeof parsed !== 'object') return emptyStore();
    const value = parsed as Partial<StoredHighScores>;
    if (
      value.version !== 1 ||
      !value.scores ||
      typeof value.scores !== 'object'
    )
      return emptyStore();
    const scores: Record<string, HighScoreEntry[]> = {};
    for (const [quizId, entries] of Object.entries(value.scores)) {
      if (!Array.isArray(entries)) continue;
      scores[quizId] = entries
        .filter(isEntry)
        .sort(compareHighScores)
        .slice(0, MAX_SCORES);
    }
    return {
      version: 1,
      playerName:
        typeof value.playerName === 'string' && value.playerName.trim()
          ? value.playerName.trim()
          : DEFAULT_PLAYER_NAME,
      scores,
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: StoredHighScores): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HIGH_SCORES_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage can be unavailable or full; the game remains playable in memory.
  }
}

export function getPlayerName(): string {
  return readStore().playerName;
}

export function getAllHighScores(): Record<string, HighScoreEntry[]> {
  return readStore().scores;
}

export function getHighScores(quizId: string): HighScoreEntry[] {
  return [...(readStore().scores[quizId] ?? [])].sort(compareHighScores);
}

export function recordHighScore(
  quizId: string,
  score: number,
  elapsedMs: number,
  now = Date.now(),
): { entry: HighScoreEntry; scores: HighScoreEntry[]; qualifies: boolean } {
  const store = readStore();
  const entry: HighScoreEntry = {
    id: `${now}-${Math.random().toString(36).slice(2)}`,
    username: store.playerName,
    score,
    elapsedMs,
    createdAt: now,
  };
  const ranked = [...(store.scores[quizId] ?? []), entry].sort(
    compareHighScores,
  );
  const scores = ranked.slice(0, MAX_SCORES);
  store.scores[quizId] = scores;
  writeStore(store);
  return {
    entry,
    scores,
    qualifies: scores.some((item) => item.id === entry.id),
  };
}

export function updateHighScoreName(
  quizId: string,
  entryId: string,
  username: string,
): HighScoreEntry[] {
  const store = readStore();
  const name = username.trim() || DEFAULT_PLAYER_NAME;
  store.playerName = name;
  const entries = (store.scores[quizId] ?? []).map((entry) =>
    entry.id === entryId ? { ...entry, username: name } : entry,
  );
  store.scores[quizId] = entries.sort(compareHighScores).slice(0, MAX_SCORES);
  writeStore(store);
  return store.scores[quizId];
}

export { DEFAULT_PLAYER_NAME, MAX_SCORES };
