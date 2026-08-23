// @vitest-environment jsdom
import { act, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { QuizProvider } from '../QuizContext';
import { QuizDetailsDialog } from '../quizSelection/QuizDetailsDialog';
import type { QuizOption } from '../quizContracts';
import { AppShell } from './AppShell';

const options: QuizOption[] = [
  { id: 'world', name: 'World UN Countries', locationIds: [] },
  { id: 'asia', name: 'Asia UN Countries', locationIds: [] },
];
let root: ReturnType<typeof createRoot> | undefined;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  window.history.replaceState({}, '', '/TerraDash/');
});

function renderShell() {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  const mounts: string[] = [];
  function QuizHarness(
    input: Parameters<
      NonNullable<Parameters<typeof AppShell>[0]['renderQuiz']>
    >[0],
  ) {
    const [revision, setRevision] = useState(0);
    useEffect(() => {
      mounts.push(input.providerKey);
    }, [input.providerKey]);
    return (
      <QuizProvider
        key={input.providerKey}
        quiz={{ id: input.quizId, locationIds: [] }}
        catalog={[]}
      >
        <div data-provider-key={input.providerKey} data-revision={revision}>
          <button
            type="button"
            data-quiz-trigger
            onClick={() => input.onSelectQuizOption(options[1])}
          >
            Choose Asia
          </button>
          <button
            type="button"
            data-replay
            onClick={() => setRevision((value) => value + 1)}
          >
            Play Again
          </button>
          {input.pendingQuiz && (
            <QuizDetailsDialog
              quiz={input.pendingQuiz}
              onClose={input.onCloseQuizDialog}
              onStart={input.onStartSelectedQuiz}
            />
          )}
          {input.autoStart && <span data-auto-start="true" />}
          <button
            type="button"
            data-consume-start
            onClick={() => {
              input.onAutoStartHandled();
              setRevision((value) => value + 1);
            }}
          >
            Consume start
          </button>
        </div>
      </QuizProvider>
    );
  }
  act(() => {
    root!.render(
      <AppShell
        quizOptions={options}
        locationIds={[]}
        defaultQuizId="world"
        renderQuiz={(input) => <QuizHarness {...input} />}
        highScores={<div data-page="high-scores" />}
        diagnostics={() => <div data-page="diagnostics" />}
      />,
    );
  });
  return { host, mounts };
}

describe('AppShell selection and route handoff', () => {
  it('keeps pending selection transient, restores focus on cancel, and commits once on start', async () => {
    const { host } = renderShell();
    const trigger = host.querySelector(
      '[data-quiz-trigger]',
    ) as HTMLButtonElement;
    await act(async () => trigger.click());
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    await act(async () =>
      (
        document.querySelector('.quiz-dialog-close') as HTMLButtonElement
      ).click(),
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await act(async () => trigger.click());
    await act(async () =>
      (document.querySelector('.primary-action') as HTMLButtonElement).click(),
    );
    expect(window.location.search).toBe('?quiz=asia&start=1');
    expect(
      host
        .querySelector('[data-provider-key]')
        ?.getAttribute('data-provider-key'),
    ).toBe('asia');
  });

  it('consumes start once for a provider and leaves Play Again idle', async () => {
    window.history.replaceState({}, '', '/TerraDash/?quiz=asia&start=1');
    const { host } = renderShell();
    expect(host.querySelector('[data-auto-start]')).toBeTruthy();
    await act(async () =>
      (host.querySelector('[data-consume-start]') as HTMLButtonElement).click(),
    );
    expect(host.querySelector('[data-auto-start]')).toBeNull();
    await act(async () =>
      (host.querySelector('[data-replay]') as HTMLButtonElement).click(),
    );
    expect(host.querySelector('[data-auto-start]')).toBeNull();
  });

  it('restores committed route state on a back/forward-style popstate', async () => {
    window.history.replaceState({}, '', '/TerraDash/?quiz=asia&start=1');
    const { host } = renderShell();
    await act(async () => {
      window.history.pushState({}, '', '/TerraDash/?quiz=world');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(
      host
        .querySelector('[data-provider-key]')
        ?.getAttribute('data-provider-key'),
    ).toBe('world');
    expect(host.querySelector('[data-auto-start]')).toBeNull();
  });
});
