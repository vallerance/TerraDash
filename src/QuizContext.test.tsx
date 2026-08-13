// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { QuizProvider, useQuiz } from './QuizContext';
import { defaultCatalog, defaultQuiz } from './quizContracts';
import type { QuizState } from './quizEngine';

let root: ReturnType<typeof createRoot> | undefined;
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
});

function Probe({
  onState,
}: {
  onState: (
    state: QuizState,
    dispatch: ReturnType<typeof useQuiz>['dispatch'],
  ) => void;
}) {
  const { state, dispatch } = useQuiz();
  onState(state, dispatch);
  return null;
}

describe('QuizProvider', () => {
  it('wires generated quiz/catalog contracts through the focused dispatch boundary', () => {
    const container = document.createElement('div');
    document.body.append(container);
    let latest: QuizState | undefined;
    let dispatch: ReturnType<typeof useQuiz>['dispatch'] | undefined;
    root = createRoot(container);
    act(() => {
      root!.render(
        <QuizProvider quiz={defaultQuiz} catalog={defaultCatalog} rng={() => 0}>
          <Probe
            onState={(state, nextDispatch) => {
              latest = state;
              dispatch = nextDispatch;
            }}
          />
        </QuizProvider>,
      );
    });
    expect(latest?.phase).toBe('idle');
    act(() => dispatch!({ type: 'start', now: 10 }));
    expect(latest?.phase).toBe('active');
    expect(latest?.order).toHaveLength(defaultQuiz.locationIds.length);
    expect(latest?.lastEvent).toEqual({ type: 'started' });
  });
});
