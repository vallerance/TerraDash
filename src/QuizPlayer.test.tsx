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
    expect(container.querySelector('.active-player')).toBeNull();
    expect(container.querySelector('.full-bleed-map')).toBeNull();
    act(() => (container.querySelector('button') as HTMLButtonElement).click());
    const input = container.querySelector(
      '[role="combobox"]',
    ) as HTMLInputElement;
    expect(input.getAttribute('aria-controls')).toBe('answer-options');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.tabIndex).toBe(0);
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
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
      ),
    );
    expect(input.getAttribute('aria-activedescendant')).toBe(
      'answer-option-iso:AAA',
    );
    act(() =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
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
    act(() =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      ),
    );
    expect(container.textContent).toContain('2 / 2');
    expect(
      container.querySelector('[aria-live="assertive"]')?.textContent,
    ).toBe('');
    expect(document.activeElement).toBe(input);
    expect(
      document.getElementById(input.getAttribute('aria-activedescendant')!),
    ).toBeTruthy();
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

  it('shares attempt-state colors across the map and remaining-attempt status', async () => {
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
          />
        </QuizProvider>,
      );
    });
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click(),
    );
    const player = container.querySelector('.active-player')!;
    const status = container.querySelector('.quiz-status')!;
    expect(player.classList.contains('attempts-remaining-3')).toBe(true);
    expect(status.classList.contains('attempts-remaining-3')).toBe(true);

    for (const remaining of [2, 1]) {
      await act(async () =>
        [...container.querySelectorAll('[role="option"]')]
          .find((option) => option.textContent === 'Bravo')!
          .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })),
      );
      await act(async () =>
        (container.querySelector('form button') as HTMLButtonElement).click(),
      );
      expect(player.classList.contains(`attempts-remaining-${remaining}`)).toBe(
        true,
      );
      expect(status.classList.contains(`attempts-remaining-${remaining}`)).toBe(
        true,
      );
    }
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
        .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })),
    );
    await act(async () => {
      const submit = container.querySelector(
        'form button',
      ) as HTMLButtonElement;
      submit.click();
      submit.click();
    });
    expect(container.textContent).toContain('2 attempts remaining');
    expect(container.textContent).toContain('1 / 1');
    expect(
      container.querySelector('[data-map-id]')?.getAttribute('data-map-id'),
    ).toBe('iso:AAA');
    expect(container.querySelector('.active-player')).toBeTruthy();
    expect(container.querySelector('.full-bleed-map')).toBeTruthy();
    expect(
      container.querySelector('[aria-live="assertive"]')?.textContent,
    ).toBe('Incorrect. Try again; the answer is not revealed.');
    await act(async () => Promise.resolve());
    await act(async () =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      ),
    );
    expect(input.value).toBe('');
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
    await act(async () => {
      input.value = 'Br';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(input.getAttribute('aria-activedescendant')).toBe(
      'answer-option-iso:BBB',
    );
    expect(
      document.getElementById(input.getAttribute('aria-activedescendant')!),
    ).toBeTruthy();
    await act(async () => {
      input.value = 'Z';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    await act(async () => {
      input.value = 'Bravo';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () =>
      [...container.querySelectorAll('[role="option"]')]
        .find((option) => option.textContent === 'Bravo')!
        .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })),
    );
    await act(async () => {
      input.value = 'Bravo edited';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () =>
      (container.querySelector('form button') as HTMLButtonElement).click(),
    );
    expect(container.textContent).toContain('2 attempts remaining');
    expect(
      container.querySelector('[aria-live="assertive"]')?.textContent,
    ).toBe(
      'Choose a canonical location from the suggestions or enter its exact name.',
    );
    await act(async () => {
      input.value = 'Alpha';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.querySelectorAll('[aria-live="assertive"]')).toHaveLength(
      1,
    );
    await act(async () =>
      [...container.querySelectorAll('[role="option"]')]
        .find((option) => option.textContent === 'Alpha')!
        .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })),
    );
    await act(async () =>
      (container.querySelector('form button') as HTMLButtonElement).click(),
    );
    expect(container.querySelectorAll('[aria-live="assertive"]')).toHaveLength(
      0,
    );
    expect(container.textContent).toContain('Run complete');
    expect(container.querySelector('.active-player')).toBeNull();
    expect(container.querySelector('.full-bleed-map')).toBeNull();
    expect(container.textContent).toContain('50%');
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click(),
    );
    expect(container.textContent).toContain('Name every place');
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click(),
    );
    expect(container.textContent).toContain('1 / 1');
    expect(container.textContent).toContain('0:00');
  });

  it('advances after three valid misses without revealing the answer and stops the timer', async () => {
    const clearInterval = vi.spyOn(window, 'clearInterval');
    const container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => {
      root!.render(
        <QuizProvider
          quiz={{ id: 'single', locationIds: ['iso:AAA'] }}
          catalog={catalog}
          rng={() => 0}
        >
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
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await act(async () =>
        [...container.querySelectorAll('[role="option"]')]
          .find((option) => option.textContent === 'Bravo')!
          .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })),
      );
      await act(async () =>
        (container.querySelector('form button') as HTMLButtonElement).click(),
      );
    }
    expect(container.textContent).toContain('Three attempts used');
    expect(container.textContent).not.toContain('Alpha');
    expect(clearInterval).toHaveBeenCalled();
  });

  it('starts a second shuffled run with fresh attempts and ordering', async () => {
    const rngValues = [0, 0.999];
    const container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => {
      root!.render(
        <QuizProvider
          quiz={quiz}
          catalog={catalog}
          rng={() => rngValues.shift() ?? 0}
        >
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
    const firstRunOrder: string[] = [];
    for (let index = 0; index < 2; index += 1) {
      const currentId = container
        .querySelector('[data-map-id]')!
        .getAttribute('data-map-id')!;
      firstRunOrder.push(currentId);
      const name = catalog.find((location) => location.id === currentId)!.name;
      const input = container.querySelector(
        '[role="combobox"]',
      ) as HTMLInputElement;
      await act(async () => {
        input.value = name;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await act(async () =>
        (container.querySelector('form button') as HTMLButtonElement).click(),
      );
    }
    expect(container.textContent).toContain('Run complete');
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click(),
    );
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click(),
    );
    expect(container.textContent).toContain('3 attempts remaining');
    expect(container.textContent).toContain('1 / 2');
    expect(
      container.querySelector('[data-map-id]')?.getAttribute('data-map-id'),
    ).toBe(firstRunOrder[1]);
    expect(
      container.querySelector('[data-map-id]')?.getAttribute('data-map-id'),
    ).not.toBe(firstRunOrder[0]);
  });
});
