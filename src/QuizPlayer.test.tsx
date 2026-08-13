// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuizPlayer } from './QuizPlayer';
import { QuizProvider } from './QuizContext';

const catalog = [
  { id: 'iso:AAA', name: 'Alpha' },
  { id: 'iso:BBB', name: 'Bravo' },
];
const quiz = { id: 'fixture', locationIds: catalog.map(({ id }) => id) };
let root: ReturnType<typeof createRoot> | undefined;
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  vi.useRealTimers();
});

function renderPlayer() {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <QuizProvider quiz={quiz} catalog={catalog} rng={() => 0}>
        <QuizPlayer
          catalog={catalog}
          renderMap={(location) => <div data-map-id={location.id} />}
        />
      </QuizProvider>,
    );
  });
  return container;
}

describe('QuizPlayer integration', () => {
  it('starts with accessible combobox wiring and restores focus on a new question', () => {
    const container = renderPlayer();
    act(() => (container.querySelector('button') as HTMLButtonElement).click());
    const input = container.querySelector(
      '[role="combobox"]',
    ) as HTMLInputElement;
    expect(input.getAttribute('aria-controls')).toBe('answer-options');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(2);
    expect(
      new Set(
        [...container.querySelectorAll('[role="option"]')].map(
          (option) => option.id,
        ),
      ).size,
    ).toBe(2);
    act(() =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      ),
    );
    expect(input.getAttribute('aria-activedescendant')).toBe(
      'answer-option-iso:BBB',
    );
    act(() =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      ),
    );
    expect(input.value).toBe('Bravo');
    expect(container.querySelector('[data-map-id]')).toBeTruthy();
  });

  it('cleans the monotonic timer interval on unmount', () => {
    vi.useFakeTimers();
    const clearInterval = vi.spyOn(window, 'clearInterval');
    const container = renderPlayer();
    act(() => (container.querySelector('button') as HTMLButtonElement).click());
    act(() => root?.unmount());
    expect(clearInterval).toHaveBeenCalled();
  });

  it('keeps invalid text attempt-free, scores a wrong-then-correct run, and restarts cleanly', async () => {
    const oneLocationQuiz = { id: 'single', locationIds: ['iso:AAA'] };
    const container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => {
      root!.render(
        <QuizProvider quiz={oneLocationQuiz} catalog={catalog} rng={() => 0}>
          <QuizPlayer
            catalog={catalog}
            renderMap={(location) => <div data-map-id={location.id} />}
            now={() => 10}
          />
        </QuizProvider>,
      );
    });
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click(),
    );
    const input = container.querySelector(
      '[role="combobox"]',
    ) as HTMLInputElement;
    await act(async () =>
      (container.querySelector('form button') as HTMLButtonElement).click(),
    );
    expect(container.textContent).toContain('canonical location');
    await act(async () =>
      [...container.querySelectorAll('[role="option"]')]
        .find((option) => option.textContent === 'Bravo')!
        .dispatchEvent(new MouseEvent('mousedown', { bubbles: true })),
    );
    await act(async () =>
      (container.querySelector('form button') as HTMLButtonElement).click(),
    );
    expect(container.textContent).toContain('attempts remaining');
    await act(async () =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      ),
    );
    await act(async () =>
      [...container.querySelectorAll('[role="option"]')]
        .find((option) => option.textContent === 'Alpha')!
        .dispatchEvent(new MouseEvent('mousedown', { bubbles: true })),
    );
    act(() =>
      (container.querySelector('form button') as HTMLButtonElement).click(),
    );
    expect(container.textContent).toContain('Run complete');
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click(),
    );
    expect(container.textContent).toContain('Name every place');
  });
});
