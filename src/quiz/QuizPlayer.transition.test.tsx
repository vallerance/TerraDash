// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { QuizPlayer } from '../QuizPlayer';
import { QuizProvider } from '../QuizContext';
import { HIGH_SCORES_STORAGE_KEY } from '../highScores';

const catalog = [
  { id: 'iso:AAA', name: 'Alpha' },
  { id: 'iso:BBB', name: 'Bravo' },
];

let root: ReturnType<typeof createRoot> | undefined;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  window.localStorage?.removeItem(HIGH_SCORES_STORAGE_KEY);
  delete window.terraDash;
});

describe('QuizPlayer phase transitions', () => {
  it('resets phase-local state and restores the console seam through StrictMode replay', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() => {
      root!.render(
        <StrictMode>
          <QuizProvider
            quiz={{
              id: 'transition',
              locationIds: catalog.map(({ id }) => id),
            }}
            catalog={catalog}
            rng={() => 0}
          >
            <QuizPlayer
              catalog={catalog}
              renderMap={(location) => <div data-map-id={location.id} />}
              now={() => 10}
            />
          </QuizProvider>
        </StrictMode>,
      );
    });

    await act(async () =>
      (host.querySelector('button') as HTMLButtonElement).click(),
    );
    expect(host.querySelector('.active-player')).toBeTruthy();
    const input = host.querySelector('#answer') as HTMLInputElement;
    await act(async () => {
      input.value = 'Al';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(input.value).toBe('Al');
    expect(typeof window.terraDash?.completeQuiz).toBe('function');

    await act(async () => window.terraDash?.completeQuiz?.());
    expect(host.querySelector('.quiz-results')).toBeTruthy();
    expect(host.querySelector('.high-score-panel')).toBeTruthy();
    expect(window.terraDash).toBeUndefined();

    await act(async () =>
      (
        [...host.querySelectorAll('button.primary-action')].find(
          (button) => button.textContent === 'Play again',
        ) as HTMLButtonElement
      ).click(),
    );
    expect(host.querySelector('.home-page')).toBeTruthy();
    expect(host.querySelector('#answer')).toBeNull();
    expect(host.querySelector('.quiz-feedback')).toBeNull();

    await act(async () =>
      (host.querySelector('button') as HTMLButtonElement).click(),
    );
    expect(host.querySelector('.active-player')).toBeTruthy();
    expect((host.querySelector('#answer') as HTMLInputElement).value).toBe('');
    expect(typeof window.terraDash?.completeQuiz).toBe('function');
  });
});
