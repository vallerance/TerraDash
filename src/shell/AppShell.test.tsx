// @vitest-environment jsdom
import { act, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { QuizProvider } from '../QuizContext';
import { QuizPage } from '../pages/QuizPage';
import { QuizDetailsDialog } from '../quizSelection/QuizDetailsDialog';
import { playableLocations, quizOptions, worldQuiz } from '../quizContracts';
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
    const { host, mounts } = renderShell();
    const trigger = host.querySelector(
      '[data-quiz-trigger]',
    ) as HTMLButtonElement;
    trigger.focus();
    await act(async () => trigger.click());
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    await act(async () =>
      (
        document.querySelector('.quiz-dialog-close') as HTMLButtonElement
      ).click(),
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    trigger.focus();
    await act(async () => trigger.click());
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    trigger.focus();
    await act(async () => trigger.click());
    const backdrop = document.querySelector(
      '.quiz-dialog-backdrop',
    ) as HTMLElement;
    await act(async () =>
      backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })),
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    trigger.focus();
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
    expect(mounts).toEqual(['world', 'asia']);
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

  it('proves the real shell-to-QuizPage path consumes start before Play again', async () => {
    window.history.replaceState({}, '', '/TerraDash/?quiz=world&start=1');
    const host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() => {
      root!.render(
        <AppShell
          quizOptions={quizOptions}
          locationIds={playableLocations.map((location) => location.id)}
          defaultQuizId={worldQuiz.id}
          renderQuiz={(input) => <QuizPage {...input} />}
          highScores={<div />}
          diagnostics={() => <div />}
        />,
      );
    });
    expect(host.querySelector('.active-player')).toBeTruthy();
    await act(async () => window.terraDash?.completeQuiz?.());
    expect(host.querySelector('.quiz-results')).toBeTruthy();
    await act(async () =>
      (
        [...host.querySelectorAll('button.primary-action')].find(
          (button) => button.textContent === 'Play again',
        ) as HTMLButtonElement
      ).click(),
    );
    expect(host.querySelector('.home-page')).toBeTruthy();
    expect(host.querySelector('.active-player')).toBeNull();
  });
});
