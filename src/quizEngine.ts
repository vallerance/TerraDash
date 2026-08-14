export type QuizPhase = 'idle' | 'active' | 'completed';
export type CatalogLocation = { id: string; name: string };
export type QuizDefinition = { id: string; locationIds: string[] };
export type LocationOutcome = {
  attempts: number;
  status: 'correct' | 'missed';
  credit: number;
};
export type QuizResults = {
  accuracy: number;
  score: number;
  missed: number;
  perfect: number;
  eventuallyCorrect: number;
  elapsedMs: number;
};
export type QuizState = {
  phase: QuizPhase;
  order: string[];
  currentIndex: number;
  attempts: number;
  outcomes: Record<string, LocationOutcome>;
  score: number;
  startedAt: number | null;
  elapsedMs: number;
  completedAt: number | null;
  results: QuizResults | null;
  lastEvent: QuizEvent;
};
export type QuizEvent =
  | {
      type: 'idle' | 'started' | 'elapsed' | 'reset';
    }
  | { type: 'accepted'; result: 'wrong' | 'correct' | 'missed' }
  | { type: 'completed'; result: 'correct' | 'missed' }
  | { type: 'rejected'; reason: RejectionReason };
export type RejectionReason =
  | 'already-active'
  | 'already-completed'
  | 'empty-quiz'
  | 'invalid-answer'
  | 'invalid-timestamp'
  | 'not-started'
  | 'non-monotonic-time'
  | 'unknown-location';
export type QuizAction =
  | { type: 'start'; now: number }
  | { type: 'read-elapsed'; now: number }
  | { type: 'submit'; now: number; selectedId?: string; text?: string }
  | { type: 'reset' };
export type EngineConfig = {
  readonly quiz: {
    readonly id: string;
    readonly locationIds: readonly string[];
  };
  readonly catalog: readonly Readonly<CatalogLocation>[];
  readonly rng: () => number;
};
export type Transition = { state: QuizState; event: QuizEvent };
import { countryNameKey } from './countryName';

const idleEvent: QuizEvent = { type: 'idle' };
export function validateQuizInputs(
  quiz: QuizDefinition,
  catalog: CatalogLocation[],
): void {
  if (
    !quiz ||
    typeof quiz.id !== 'string' ||
    !quiz.id.trim() ||
    !Array.isArray(quiz.locationIds)
  )
    throw new TypeError(
      'Quiz definition must contain an id and locationIds array',
    );
  if (!Array.isArray(catalog)) throw new TypeError('Catalog must be an array');
  const catalogIds = new Set<string>();
  const names = new Set<string>();
  for (const location of catalog) {
    if (
      !location ||
      typeof location.id !== 'string' ||
      !location.id.trim() ||
      typeof location.name !== 'string'
    )
      throw new TypeError('Catalog locations require nonempty string IDs');
    if (catalogIds.has(location.id))
      throw new TypeError(`Duplicate catalog ID: ${location.id}`);
    const name = countryNameKey(location.name);
    if (!name)
      throw new TypeError(`Catalog location has an empty name: ${location.id}`);
    if (names.has(name))
      throw new TypeError(`Duplicate canonical catalog name: ${location.name}`);
    catalogIds.add(location.id);
    names.add(name);
  }
  if (quiz.locationIds.some((id) => typeof id !== 'string' || !id.trim()))
    throw new TypeError('Quiz locationIds require nonempty string IDs');
  if (new Set(quiz.locationIds).size !== quiz.locationIds.length)
    throw new TypeError('Quiz locationIds must be unique');
  if (quiz.locationIds.some((id) => !catalogIds.has(id)))
    throw new TypeError('Quiz locationIds must resolve to the catalog');
}
export function createEngineConfig(
  quiz: QuizDefinition,
  catalog: CatalogLocation[],
  rng: () => number = Math.random,
): EngineConfig {
  validateQuizInputs(quiz, catalog);
  if (typeof rng !== 'function') throw new TypeError('RNG must be a function');
  const copiedQuiz = Object.freeze({
    id: quiz.id,
    locationIds: Object.freeze([...quiz.locationIds]),
  });
  const copiedCatalog = Object.freeze(
    catalog.map((location) =>
      Object.freeze({ id: location.id, name: location.name }),
    ),
  );
  return Object.freeze({
    quiz: copiedQuiz,
    catalog: copiedCatalog,
    rng,
  });
}
export function shuffleIds(
  ids: readonly string[],
  rng: () => number,
): string[] {
  if (typeof rng !== 'function') throw new TypeError('RNG must be a function');
  const result = [...ids];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const random = rng();
    if (!Number.isFinite(random) || random < 0 || random >= 1)
      throw new RangeError('RNG must return a finite value in [0, 1)');
    const swapIndex = Math.floor(random * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
export function createIdleState(): QuizState {
  return {
    phase: 'idle',
    order: [],
    currentIndex: 0,
    attempts: 0,
    outcomes: {},
    score: 0,
    startedAt: null,
    elapsedMs: 0,
    completedAt: null,
    results: null,
    lastEvent: idleEvent,
  };
}
export function currentLocationId(state: QuizState): string | null {
  return state.phase === 'active'
    ? (state.order[state.currentIndex] ?? null)
    : null;
}
export function normalizeText(value: string): string {
  return countryNameKey(value);
}
function reject(state: QuizState, reason: RejectionReason): Transition {
  return {
    state: { ...state, lastEvent: { type: 'rejected', reason } },
    event: { type: 'rejected', reason },
  };
}
function validTime(
  now: number,
  previous: number | null,
): RejectionReason | null {
  if (!Number.isFinite(now) || now < 0) return 'invalid-timestamp';
  if (previous !== null && now < previous) return 'non-monotonic-time';
  return null;
}
function resolveAnswer(
  config: EngineConfig,
  action: Extract<QuizAction, { type: 'submit' }>,
): string | null {
  if (action.selectedId !== undefined) {
    return config.catalog.some((location) => location.id === action.selectedId)
      ? action.selectedId
      : null;
  }
  if (action.text === undefined) return null;
  const normalized = countryNameKey(action.text);
  return (
    config.catalog.find(
      (location) => normalizeText(location.name) === normalized,
    )?.id ?? null
  );
}
function finish(
  state: QuizState,
  completedAt: number,
  score: number,
  outcomes: Record<string, LocationOutcome>,
  result: 'correct' | 'missed',
): QuizState {
  const total = state.order.length;
  const missed = Object.values(outcomes).filter(
    (outcome) => outcome.status === 'missed',
  ).length;
  const perfect = Object.values(outcomes).filter(
    (outcome) => outcome.credit === 1,
  ).length;
  const eventuallyCorrect = Object.values(outcomes).filter(
    (outcome) => outcome.status === 'correct' && outcome.credit < 1,
  ).length;
  const elapsedMs = completedAt - (state.startedAt ?? completedAt);
  return {
    ...state,
    phase: 'completed',
    currentIndex: total,
    attempts: 0,
    outcomes: { ...outcomes },
    score,
    completedAt,
    elapsedMs,
    results: {
      accuracy: total ? score / total : 0,
      score,
      missed,
      perfect,
      eventuallyCorrect,
      elapsedMs,
    },
    lastEvent: { type: 'completed', result },
  };
}
export function reduceQuiz(
  state: QuizState,
  action: QuizAction,
  config: EngineConfig,
): Transition {
  if (action.type === 'reset')
    return { state: createIdleState(), event: { type: 'reset' } };
  if (action.type === 'start') {
    const timeError = validTime(action.now, null);
    if (timeError) return reject(state, timeError);
    if (state.phase === 'active') return reject(state, 'already-active');
    if (state.phase === 'completed') return reject(state, 'already-completed');
    if (!config.quiz.locationIds.length) return reject(state, 'empty-quiz');
    const order = shuffleIds(config.quiz.locationIds, config.rng);
    return {
      state: {
        ...createIdleState(),
        phase: 'active',
        order,
        startedAt: action.now,
        lastEvent: { type: 'started' },
      },
      event: { type: 'started' },
    };
  }
  if (state.phase !== 'active')
    return reject(
      state,
      state.phase === 'completed' ? 'already-completed' : 'not-started',
    );
  const timeError = validTime(
    action.now,
    state.startedAt === null ? null : state.startedAt + state.elapsedMs,
  );
  if (timeError) return reject(state, timeError);
  const elapsedMs = action.now - (state.startedAt ?? action.now);
  if (action.type === 'read-elapsed')
    return {
      state: { ...state, elapsedMs, lastEvent: { type: 'elapsed' } },
      event: { type: 'elapsed' },
    };
  const answerId = resolveAnswer(config, action);
  if (!answerId) return reject(state, 'invalid-answer');
  const currentId = currentLocationId(state);
  if (!currentId) return reject(state, 'not-started');
  const attempts = state.attempts + 1;
  const outcomes = { ...state.outcomes };
  if (answerId !== currentId) {
    if (attempts < 3)
      return {
        state: {
          ...state,
          attempts,
          elapsedMs,
          lastEvent: { type: 'accepted', result: 'wrong' },
        },
        event: { type: 'accepted', result: 'wrong' },
      };
    outcomes[currentId] = { attempts: 3, status: 'missed', credit: 0 };
    const next = state.currentIndex + 1;
    const score = state.score;
    if (next === state.order.length)
      return {
        state: finish(
          { ...state, elapsedMs },
          action.now,
          score,
          outcomes,
          'missed',
        ),
        event: { type: 'completed', result: 'missed' },
      };
    return {
      state: {
        ...state,
        currentIndex: next,
        attempts: 0,
        elapsedMs,
        outcomes,
        lastEvent: { type: 'accepted', result: 'missed' },
      },
      event: { type: 'accepted', result: 'missed' },
    };
  }
  const credit = [1, 0.5, 0.25][attempts - 1];
  outcomes[currentId] = { attempts, status: 'correct', credit };
  const score = state.score + credit;
  const next = state.currentIndex + 1;
  if (next === state.order.length)
    return {
      state: finish(
        { ...state, elapsedMs },
        action.now,
        score,
        outcomes,
        'correct',
      ),
      event: { type: 'completed', result: 'correct' },
    };
  return {
    state: {
      ...state,
      currentIndex: next,
      attempts: 0,
      outcomes,
      score,
      elapsedMs,
      lastEvent: { type: 'accepted', result: 'correct' },
    },
    event: { type: 'accepted', result: 'correct' },
  };
}
