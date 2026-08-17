import { describe, expect, it } from 'vitest';
import {
  createEngineConfig,
  createIdleState,
  currentLocationId,
  reduceQuiz,
  shuffleIds,
  type CatalogLocation,
  type QuizDefinition,
  type QuizState,
} from './quizEngine';

const catalog: CatalogLocation[] = [
  { id: 'iso:AAA', name: 'Alpha' },
  { id: 'iso:BBB', name: 'Bravo' },
  { id: 'iso:CCC', name: 'Charlie' },
];
const quiz: QuizDefinition = {
  id: 'test',
  locationIds: catalog.map(({ id }) => id),
};
const config = (rng = () => 0.5) => createEngineConfig(quiz, catalog, rng);
function transition(
  state: QuizState,
  action: Parameters<typeof reduceQuiz>[1],
  rng = () => 0.5,
) {
  return reduceQuiz(state, action, config(rng));
}
function start(rng = () => 0.5) {
  return transition(createIdleState(), { type: 'start', now: 10 }, rng).state;
}
function submit(state: QuizState, text: string, now: number) {
  return transition(state, { type: 'submit', text, now });
}

describe('quiz engine', () => {
  it('uses Fisher–Yates with deterministic boundary RNG values', () => {
    expect(shuffleIds(['a', 'b', 'c'], () => 0)).toEqual(['b', 'c', 'a']);
    expect(shuffleIds(['a', 'b', 'c'], () => 1 - Number.EPSILON)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(shuffleIds(['a', 'b', 'c'], () => 0.25)).toEqual(
      shuffleIds(['a', 'b', 'c'], () => 0.25),
    );
    expect(() => shuffleIds(['a', 'b'], () => 1)).toThrow(RangeError);
    expect(() => shuffleIds(['a', 'b'], () => -0.1)).toThrow(RangeError);
    expect(() => shuffleIds(['a', 'b'], () => Infinity)).toThrow(RangeError);
    expect(() => shuffleIds(['a', 'b'], () => NaN)).toThrow(RangeError);
  });
  it('visits every configured ID exactly once', () => {
    const state = start();
    const visited: string[] = [];
    let current = state;
    for (const id of state.order) {
      expect(currentLocationId(current)).toBe(id);
      visited.push(id);
      current = submit(
        current,
        catalog.find((item) => item.id === id)!.name,
        visited.length + 10,
      ).state;
    }
    expect(new Set(visited)).toEqual(new Set(quiz.locationIds));
    expect(current.phase).toBe('completed');
  });
  it('awards first, second, and third-attempt credits', () => {
    let state = start();
    const firstId = currentLocationId(state)!;
    const answer = catalog.find((item) => item.id === firstId)!.name;
    expect(submit(state, 'wrong', 11).event).toEqual({
      type: 'rejected',
      reason: 'invalid-answer',
    });
    state = submit(state, answer, 11).state;
    expect(state.outcomes[firstId]?.credit).toBe(1);

    const secondId = currentLocationId(state)!;
    const secondWrongId = catalog.find((item) => item.id !== secondId)!.id;
    state = transition(state, {
      type: 'submit',
      selectedId: secondWrongId,
      now: 12,
    }).state;
    state = submit(
      state,
      catalog.find((item) => item.id === secondId)!.name,
      13,
    ).state;
    expect(state.outcomes[secondId]?.credit).toBe(0.5);

    const thirdId = currentLocationId(state)!;
    const thirdWrongId = catalog.find((item) => item.id !== thirdId)!.id;
    state = transition(state, {
      type: 'submit',
      selectedId: thirdWrongId,
      now: 14,
    }).state;
    state = transition(state, {
      type: 'submit',
      selectedId: thirdWrongId,
      now: 15,
    }).state;
    state = submit(
      state,
      catalog.find((item) => item.id === thirdId)!.name,
      16,
    ).state;
    expect(state.outcomes[thirdId]?.credit).toBe(0.25);
  });
  it('keeps a valid wrong answer active and records a three-miss outcome', () => {
    let state = start();
    const current = currentLocationId(state)!;
    const wrong = catalog.find((item) => item.id !== current)!.id;
    for (const now of [11, 12]) {
      const result = transition(state, {
        type: 'submit',
        selectedId: wrong,
        now,
      });
      expect(result.event.type).toBe('accepted');
      expect(currentLocationId(result.state)).toBe(current);
      state = result.state;
    }
    state = transition(state, {
      type: 'submit',
      selectedId: wrong,
      now: 13,
    }).state;
    expect(state.currentIndex).toBe(1);
    expect(state.outcomes[current]).toEqual({
      attempts: 3,
      status: 'missed',
      credit: 0,
    });
  });
  it('resolves trimmed case-insensitive canonical names and selected IDs only', () => {
    let state = start();
    const answer = catalog.find(
      (item) => item.id === currentLocationId(state),
    )!;
    expect(
      submit(state, `  ${answer.name.toUpperCase()}  `, 11).event.type,
    ).toBe('accepted');
    state = start();
    expect(
      transition(state, { type: 'submit', selectedId: answer.id, now: 11 })
        .event.type,
    ).toBe('accepted');
    state = start();
    const invalid = submit(state, 'Al', 11);
    expect(invalid.event).toEqual({
      type: 'rejected',
      reason: 'invalid-answer',
    });
    expect(invalid.state.attempts).toBe(0);
  });
  it('resolves accented and punctuated answers through the shared key', () => {
    const localized = [{ id: 'iso:AAA', name: 'Côte d’Ivoire' }];
    const localizedQuiz = { id: 'localized', locationIds: ['iso:AAA'] };
    const localizedConfig = createEngineConfig(
      localizedQuiz,
      localized,
      () => 0,
    );
    const state = reduceQuiz(
      createIdleState(),
      { type: 'start', now: 1 },
      localizedConfig,
    ).state;
    expect(
      reduceQuiz(
        state,
        { type: 'submit', text: "cote d'ivoire", now: 2 },
        localizedConfig,
      ).event.type,
    ).toBe('completed');
    expect(
      reduceQuiz(
        state,
        { type: 'submit', text: 'cote ivoire', now: 2 },
        localizedConfig,
      ).event,
    ).toEqual({ type: 'rejected', reason: 'invalid-answer' });
  });
  it('freezes mixed-run results and accuracy', () => {
    let state = start(() => 0);
    const first = currentLocationId(state)!;
    state = submit(
      state,
      catalog.find((item) => item.id === first)!.name,
      20,
    ).state;
    for (let i = 0; i < 3; i += 1) {
      const id = currentLocationId(state)!;
      state = transition(state, {
        type: 'submit',
        selectedId: catalog.find((item) => item.id !== id)!.id,
        now: 21 + i,
      }).state;
    }
    const id = currentLocationId(state)!;
    state = submit(
      state,
      catalog.find((item) => item.id === id)!.name,
      30,
    ).state;
    expect(state.phase).toBe('completed');
    expect(state.results).toMatchObject({
      score: 2,
      accuracy: 2 / 3,
      missed: 1,
      perfect: 2,
    });
    const frozen = transition(state, { type: 'read-elapsed', now: 100 });
    expect(frozen.event).toEqual({
      type: 'rejected',
      reason: 'already-completed',
    });
    expect(frozen.state.results).toEqual(state.results);
  });
  it('uses monotonic elapsed time and stops it at completion', () => {
    let state = start();
    expect(
      transition(state, { type: 'read-elapsed', now: 15 }).state.elapsedMs,
    ).toBe(5);
    const backward = transition(state, { type: 'read-elapsed', now: 9 });
    expect(backward.event).toEqual({
      type: 'rejected',
      reason: 'non-monotonic-time',
    });
    const answer = catalog.find(
      (item) => item.id === currentLocationId(state),
    )!.name;
    state = submit(state, answer, 20).state;
    while (state.phase === 'active') {
      const id = currentLocationId(state)!;
      state = submit(
        state,
        catalog.find((item) => item.id === id)!.name,
        25,
      ).state;
    }
    expect(state.elapsedMs).toBe(15);
  });
  it('debug-completes through the normal result path with a ten-minute offset', () => {
    let state = start(() => 0);
    const first = currentLocationId(state)!;
    state = submit(
      state,
      catalog.find((location) => location.id === first)!.name,
      20,
    ).state;
    const completed = transition(state, {
      type: 'complete-debug',
      now: 600020,
    });
    expect(completed.event).toEqual({ type: 'completed', result: 'missed' });
    expect(completed.state.phase).toBe('completed');
    expect(completed.state.elapsedMs).toBe(600010);
    expect(completed.state.results?.missed).toBe(2);
    expect(completed.state.outcomes[first]).toEqual({
      attempts: 1,
      status: 'correct',
      credit: 1,
    });
    expect(Object.values(completed.state.outcomes)).toContainEqual({
      attempts: 3,
      status: 'missed',
      credit: 0,
    });
    expect(
      transition(createIdleState(), { type: 'complete-debug', now: 600000 })
        .event,
    ).toEqual({ type: 'rejected', reason: 'not-started' });
    expect(
      transition(completed.state, { type: 'complete-debug', now: 1200020 })
        .event,
    ).toEqual({ type: 'rejected', reason: 'already-completed' });
  });
  it('resets without leaking order, answers, score, or time and starts a new shuffle', () => {
    let calls = 0;
    const rng = () => (calls++ === 0 ? 0 : 0.9);
    let state = start(rng);
    const originalOrder = state.order;
    state = transition(
      state,
      { type: 'submit', selectedId: 'iso:BBB', now: 11 },
      rng,
    ).state;
    state = transition(state, { type: 'reset' }, rng).state;
    expect(state).toEqual(createIdleState());
    state = transition(state, { type: 'start', now: 100 }, rng).state;
    expect(state.order).not.toEqual(originalOrder);
  });
  it('rejects illegal actions and malformed inputs explicitly', () => {
    expect(
      transition(createIdleState(), { type: 'submit', text: 'Alpha', now: 1 })
        .event,
    ).toEqual({ type: 'rejected', reason: 'not-started' });
    expect(() =>
      createEngineConfig({ id: 'bad', locationIds: ['missing'] }, catalog),
    ).toThrow();
    expect(() =>
      createEngineConfig({ id: 'bad', locationIds: ['iso:AAA'] }, [
        { id: 'iso:AAA', name: 'Alpha' },
        { id: 'iso:AAA', name: 'Other' },
      ]),
    ).toThrow();
    expect(() =>
      createEngineConfig({ id: ' ', locationIds: ['iso:AAA'] }, catalog),
    ).toThrow();
    expect(() =>
      createEngineConfig({ id: 'bad', locationIds: [' '] }, catalog),
    ).toThrow();
    expect(() =>
      createEngineConfig({ id: 'bad', locationIds: ['iso:AAA'] }, [
        { id: 'iso:AAA', name: 3 as unknown as string },
      ]),
    ).toThrow();
    expect(() =>
      createEngineConfig({ id: 'bad', locationIds: ['iso:AAA'] }, [
        { id: '   ', name: 'Blank ID' },
      ]),
    ).toThrow();
    expect(() =>
      createEngineConfig({ id: 'empty', locationIds: [] }, catalog),
    ).not.toThrow();
    const emptyConfig = createEngineConfig(
      { id: 'empty', locationIds: [] },
      catalog,
    );
    const empty = reduceQuiz(
      createIdleState(),
      { type: 'start', now: 1 },
      emptyConfig,
    );
    expect(empty.event).toEqual({ type: 'rejected', reason: 'empty-quiz' });
  });
  it('freezes copied configuration and isolates it from input mutation', () => {
    const inputQuiz = { id: 'mutable', locationIds: ['iso:AAA', 'iso:BBB'] };
    const inputCatalog = catalog.map((location) => ({ ...location }));
    const isolated = createEngineConfig(inputQuiz, inputCatalog, () => 0);
    inputQuiz.locationIds[0] = 'iso:CCC';
    inputCatalog[0].name = 'Changed';
    expect(isolated.quiz.locationIds).toEqual(['iso:AAA', 'iso:BBB']);
    expect(isolated.catalog[0].name).toBe('Alpha');
    expect(() =>
      (isolated.quiz.locationIds as string[]).push('iso:CCC'),
    ).toThrow();
    expect(
      () => ((isolated.catalog as CatalogLocation[])[0].name = 'Changed'),
    ).toThrow();
    expect(
      () => ((isolated as { rng: () => number }).rng = () => 0.9),
    ).toThrow();
  });
});
