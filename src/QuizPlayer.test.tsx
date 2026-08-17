// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuizPlayer } from './QuizPlayer';
import { QuizProvider } from './QuizContext';
import catalogData from '../data/generated/catalog.json';
import { DiagnosticsMap } from './diagnostics';

const catalog = [
  { id: 'iso:AAA', name: 'Alpha' },
  { id: 'iso:BBB', name: 'Bravo' },
];
const longCatalog = [
  ...catalog,
  { id: 'iso:CCC', name: 'Charlie' },
  { id: 'iso:DDD', name: 'Delta' },
];
const quiz = { id: 'fixture', locationIds: catalog.map(({ id }) => id) };
let root: ReturnType<typeof createRoot> | undefined;
class TestResizeObserver {
  observe() {}
  disconnect() {}
}
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  vi.useRealTimers();
});

vi.stubGlobal('ResizeObserver', TestResizeObserver);

function renderPlayer(catalogOverride = catalog) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <QuizProvider
        quiz={{
          id: 'fixture',
          locationIds: catalogOverride.map(({ id }) => id),
        }}
        catalog={catalogOverride}
        rng={() => 0}
      >
        <QuizPlayer
          catalog={catalogOverride}
          renderMap={(location) => <div data-map-id={location.id} />}
        />
      </QuizProvider>,
    );
  });
  return container;
}

describe('QuizPlayer integration', () => {
  it('exposes the console completion command and restores the global safely', async () => {
    const previousCommand = () => 'ignored' as const;
    const previousObject = {
      marker: 'preserve',
      completeQuiz: previousCommand,
    };
    window.terraDash = previousObject;
    const container = renderPlayer();
    expect(window.terraDash).toBe(previousObject);
    expect(window.terraDash.completeQuiz?.()).toBe('ignored');
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click(),
    );
    await act(async () => {
      expect(window.terraDash?.completeQuiz?.()).toBe('completed');
    });
    expect(container.textContent).toContain('Run complete');
    expect(container.querySelector('.results-grid')?.textContent).toContain(
      '10:00',
    );
    expect(container.querySelector('.results-grid')?.textContent).toContain(
      '2',
    );
    expect(window.terraDash?.completeQuiz?.()).toBe('ignored');
    act(() => root?.unmount());
    root = undefined;
    expect(window.terraDash).toBe(previousObject);
    expect(window.terraDash.completeQuiz).toBe(previousCommand);
  });

  it('removes the installed global when no prior namespace exists', () => {
    delete window.terraDash;
    const container = renderPlayer();
    const namespace = (
      window as Window & { terraDash?: { completeQuiz?: unknown } }
    ).terraDash;
    expect(typeof namespace?.completeQuiz).toBe('function');
    act(() => root?.unmount());
    root = undefined;
    expect(window.terraDash).toBeUndefined();
    container.remove();
  });

  it('uses accent and punctuation-insensitive exact closure and Enter submission while preserving display', async () => {
    const localized = [{ id: 'iso:AAA', name: 'Côte d’Ivoire' }];
    const container = renderPlayer(localized);
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click(),
    );
    const input = container.querySelector(
      '[role="combobox"]',
    ) as HTMLInputElement;
    await act(async () => {
      input.value = "cote d'ivoire";
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.value).toBe("cote d'ivoire");
    await act(async () =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      ),
    );
    expect(container.textContent).toContain('Correct. Next location.');
  });

  it('renders one standalone header surface, four labeled status columns, and visual-only feedback', async () => {
    vi.useFakeTimers();
    const container = renderPlayer();
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click(),
    );
    expect(container.querySelector('.results-grid')).toBeNull();
    expect(container.textContent).not.toContain('Score');
    expect(
      container.querySelectorAll('.active-player > .quiz-header'),
    ).toHaveLength(1);
    expect(container.querySelectorAll('.status-item')).toHaveLength(4);
    expect(container.textContent).toContain('Locations correct');
    expect(container.textContent).toContain('Locations remaining');
    expect(container.textContent).toContain('Accuracy');
    expect(container.querySelector('.status-correct strong')?.textContent).toBe(
      '0/0',
    );
    expect(
      container.querySelector('.status-accuracy strong')?.textContent,
    ).toBe('0.00%');
    const input = container.querySelector(
      '[role="combobox"]',
    ) as HTMLInputElement;
    const answer = catalog.find(
      (item) =>
        item.id ===
        container.querySelector('[data-map-id]')?.getAttribute('data-map-id'),
    )!.name;
    await act(async () => {
      input.value = answer;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () =>
      (container.querySelector('form button') as HTMLButtonElement).click(),
    );
    expect(
      container.querySelector('.feedback-correct .feedback-check'),
    ).not.toBeNull();
    expect(container.querySelector('.status-correct strong')?.textContent).toBe(
      '1/1',
    );
    expect(
      container.querySelector('.status-accuracy strong')?.textContent,
    ).toBe('100.00%');
    expect(
      container
        .querySelector('.quiz-feedback-icon')
        ?.getAttribute('aria-hidden'),
    ).toBe('true');
    expect(
      container.querySelector('.quiz-feedback')?.getAttribute('aria-live'),
    ).toBe('assertive');
    expect(container.querySelector('.quiz-feedback')?.textContent).toBe(
      'Correct. Next location.',
    );
  });

  it('shows attempt-weighted live accuracy after a second-attempt answer', async () => {
    const container = renderPlayer();
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click(),
    );
    const currentId = container
      .querySelector('[data-map-id]')
      ?.getAttribute('data-map-id');
    const correct = catalog.find(({ id }) => id === currentId)!;
    const wrong = catalog.find(({ id }) => id !== currentId)!;
    const submitAnswer = async (name: string) => {
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
    };

    await submitAnswer(wrong.name);
    await submitAnswer(correct.name);

    expect(container.querySelector('.status-correct strong')?.textContent).toBe(
      '1/1',
    );
    expect(
      container.querySelector('.status-accuracy strong')?.textContent,
    ).toBe('50.00%');
  });

  it('shows correct answers over total and increments only after a correct completion', async () => {
    const container = renderPlayer();
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click(),
    );
    const progress = () => container.querySelector('.progress')?.textContent;
    expect(progress()).toBe('0 / 0 locations correct');
    expect(container.textContent).toContain('2 locations remaining');
    const currentId = container
      .querySelector('[data-map-id]')
      ?.getAttribute('data-map-id');
    const answer = catalog.find((location) => location.id === currentId)!.name;
    const input = container.querySelector(
      '[role="combobox"]',
    ) as HTMLInputElement;
    await act(async () => {
      input.value = answer;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      ),
    );
    await act(async () =>
      (container.querySelector('form button') as HTMLButtonElement).click(),
    );
    expect(progress()).toBe('1 / 1 locations correct');
    expect(container.textContent).toContain('1 location remaining');
  });

  it('closes for empty and case-insensitive exact values, while partial values stay open', async () => {
    const container = renderPlayer();
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click(),
    );
    const input = container.querySelector(
      '[role="combobox"]',
    ) as HTMLInputElement;
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
    await act(async () => {
      input.value = 'alpha';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
    await act(async () => {
      input.value = 'alp';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('[role="option"]')?.textContent).toBe(
      'Alpha',
    );
  });

  it('submits an exact-match value from the closed dropdown', async () => {
    const container = renderPlayer();
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click(),
    );
    const input = container.querySelector(
      '[role="combobox"]',
    ) as HTMLInputElement;
    const currentId = container
      .querySelector('[data-map-id]')
      ?.getAttribute('data-map-id');
    const exactName = catalog.find(
      (location) => location.id === currentId,
    )!.name;
    await act(async () => {
      input.value = exactName.toUpperCase();
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    await act(async () =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      ),
    );
    expect(container.textContent).toContain('Correct. Next location.');
  });

  it('keeps a no-match dropdown visible without making its message selectable', async () => {
    const container = renderPlayer();
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click(),
    );
    const input = container.querySelector(
      '[role="combobox"]',
    ) as HTMLInputElement;
    await act(async () => {
      input.value = 'not-a-location';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      'No matches',
    );
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
    await act(async () =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      ),
    );
    expect(container.textContent).toContain('canonical location');
    expect(container.textContent).toContain('3 guesses remaining');
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
  });

  it('keeps result feedback in the subheader for three seconds without panel graphics', async () => {
    vi.useFakeTimers();
    const container = renderPlayer();
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click(),
    );
    const currentId = container
      .querySelector('[data-map-id]')
      ?.getAttribute('data-map-id');
    const answer = catalog.find((location) => location.id === currentId)!.name;
    const input = container.querySelector(
      '[role="combobox"]',
    ) as HTMLInputElement;
    await act(async () => {
      input.value = answer;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () =>
      (container.querySelector('form button') as HTMLButtonElement).click(),
    );
    expect(container.querySelector('.quiz-feedback')?.textContent).toBe(
      'Correct. Next location.',
    );
    expect(container.querySelector('.answer-panel .feedback')).toBeNull();
    expect(container.querySelector('.answer-result')).toBeNull();
    await act(async () => Promise.resolve());
    await act(async () => vi.advanceTimersByTime(2999));
    expect(container.querySelector('.quiz-feedback')?.textContent).toBe(
      'Correct. Next location.',
    );
    await act(async () => vi.runOnlyPendingTimers());
    expect(container.querySelector('.quiz-feedback')?.textContent).toBe('');
  });

  it('keeps final-incorrect feedback through the next question and restarts on a newer result', async () => {
    vi.useFakeTimers();
    const container = renderPlayer();
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click(),
    );
    const currentId = container
      .querySelector('[data-map-id]')
      ?.getAttribute('data-map-id');
    const wrongAnswer = currentId === 'iso:AAA' ? 'Bravo' : 'Alpha';
    const input = container.querySelector(
      '[role="combobox"]',
    ) as HTMLInputElement;
    const submit = () =>
      (container.querySelector('form button') as HTMLButtonElement).click();
    await act(async () => {
      input.value = wrongAnswer;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => submit());
    await act(async () => submit());
    await act(async () => submit());
    expect(container.querySelector('.quiz-feedback')?.textContent).toBe(
      'Three attempts used. The answer is not revealed.',
    );
    expect(
      container.querySelector('[data-map-id]')?.getAttribute('data-map-id'),
    ).toBe(currentId === 'iso:AAA' ? 'iso:BBB' : 'iso:AAA');
    await act(async () => vi.advanceTimersByTime(2999));
    expect(container.querySelector('.quiz-feedback')?.textContent).toContain(
      'Three attempts used',
    );
    const nextId = currentId === 'iso:AAA' ? 'iso:BBB' : 'iso:AAA';
    const nextAnswer = catalog.find((location) => location.id === nextId)!.name;
    await act(async () => {
      input.value = nextAnswer;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => submit());
    expect(container.querySelector('.quiz-feedback')?.textContent).toBe(
      'Correct. Next location.',
    );
    await act(async () => vi.advanceTimersByTime(2999));
    expect(container.querySelector('.quiz-feedback')?.textContent).toContain(
      'Correct',
    );
    await act(async () => vi.runOnlyPendingTimers());
    expect(container.querySelector('.quiz-feedback')?.textContent).toBe('');
  });

  it('keeps final feedback visible on the completed last-question card', async () => {
    vi.useFakeTimers();
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
    const input = container.querySelector(
      '[role="combobox"]',
    ) as HTMLInputElement;
    await act(async () => {
      input.value = 'Alpha';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () =>
      (container.querySelector('form button') as HTMLButtonElement).click(),
    );
    expect(
      container.querySelector('.completion-header .quiz-feedback')?.textContent,
    ).toBe('Correct. Next location.');
    expect(container.querySelector('.answer-panel')).toBeNull();
    await act(async () => vi.runOnlyPendingTimers());
    expect(
      container.querySelector('.completion-header .quiz-feedback')?.textContent,
    ).toBe('');
  });

  it('starts with accessible combobox wiring and restores focus on a new question', () => {
    const container = renderPlayer();
    expect(container.querySelector('.active-player')).toBeNull();
    expect(container.querySelector('.full-bleed-map')).toBeNull();
    act(() => (container.querySelector('button') as HTMLButtonElement).click());
    const input = container.querySelector(
      '[role="combobox"]',
    ) as HTMLInputElement;
    expect(input.getAttribute('aria-controls')).toBe('answer-options');
    expect(
      container.querySelector('[aria-label="Move answer form"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('.submit-arrow[aria-label="Submit answer"]'),
    ).toBeTruthy();
    expect(container.querySelector('.submit-arrow .submit-icon')).toBeTruthy();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.tabIndex).toBe(0);
    act(() => {
      input.value = 'a';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
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
      (container.querySelector('form button') as HTMLButtonElement).click(),
    );
    expect(container.textContent).toContain('1 / 1 locations correct');
    expect(
      container.querySelector('[aria-live="assertive"]')?.textContent,
    ).toBe('Correct. Next location.');
    expect(container.querySelector('.quiz-feedback')?.textContent).toBe(
      'Correct. Next location.',
    );
    expect(container.querySelector('.answer-result')).toBeNull();
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
    expect(container.querySelector('[data-map-id]')).toBeTruthy();
  });

  it('preserves the production stage-to-map-box and overlay contract', () => {
    const container = renderPlayer();
    act(() => (container.querySelector('button') as HTMLButtonElement).click());
    const stage = container.querySelector('.map-stage')!;
    expect(
      stage.querySelector(
        ':scope > .map-slot.full-bleed-map > .map-frame > [data-map-id]',
      ),
    ).toBeTruthy();
    expect(stage.lastElementChild?.className).toBe('answer-panel');
  });

  it('gives quiz and diagnostics the same shared stage inputs', async () => {
    const container = document.createElement('main');
    document.body.append(container);
    root = createRoot(container);
    await act(async () =>
      root!.render(
        <QuizProvider quiz={quiz} catalog={catalog} rng={() => 0}>
          <QuizPlayer
            catalog={catalog}
            renderMap={(location) => <div data-map-id={location.id} />}
          />
          <DiagnosticsMap location={catalogData[0]} />
        </QuizProvider>,
      ),
    );
    await act(async () =>
      (
        container.querySelector('.home-page button') as HTMLButtonElement
      ).click(),
    );

    const stages = [...container.querySelectorAll('.map-stage')];
    expect(stages).toHaveLength(2);
    expect(
      stages.map((stage) =>
        stage.getAttribute('data-map-stage-reserved-block'),
      ),
    ).toEqual(['4.75rem', '4.75rem']);
    expect(
      stages.map(
        (stage) =>
          stage.querySelector(':scope > .map-slot.full-bleed-map > .map-frame')
            ?.className,
      ),
    ).toEqual(['map-frame', 'map-frame']);
    expect(stages.map((stage) => stage.className)).toEqual([
      'map-stage',
      'map-stage',
    ]);
    expect(container.querySelector('.answer-panel')).toBeTruthy();
  });

  it('keeps highlighted options inside the list and resets its scroll without moving the document', () => {
    const container = renderPlayer(longCatalog);
    act(() => (container.querySelector('button') as HTMLButtonElement).click());
    const input = container.querySelector(
      '[role="combobox"]',
    ) as HTMLInputElement;
    act(() => {
      input.value = 'a';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const list = container.querySelector('.suggestions') as HTMLUListElement;
    const options = [...container.querySelectorAll('[role="option"]')];
    input.focus();
    Object.defineProperties(list, {
      clientHeight: { configurable: true, value: 40 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });
    options.forEach((option, index) => {
      Object.defineProperties(option, {
        offsetTop: { configurable: true, value: index * 20 },
        offsetHeight: { configurable: true, value: 20 },
      });
    });
    const documentScroll = [
      document.documentElement.scrollLeft,
      document.documentElement.scrollTop,
    ];
    const expectStable = () => {
      expect(document.activeElement).toBe(input);
      expect([
        document.documentElement.scrollLeft,
        document.documentElement.scrollTop,
      ]).toEqual(documentScroll);
    };
    act(() =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      ),
    );
    expect(list.scrollTop).toBe(0);
    expectStable();
    act(() =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      ),
    );
    expect(list.scrollTop).toBe(20);
    expectStable();
    act(() =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      ),
    );
    expect(list.scrollTop).toBe(40);
    expect(input.getAttribute('aria-activedescendant')).toBe(options[3].id);
    expectStable();
    act(() =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
      ),
    );
    expect(list.scrollTop).toBe(40);
    expectStable();
    act(() =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
      ),
    );
    expect(list.scrollTop).toBe(20);
    expect(input.getAttribute('aria-activedescendant')).toBe(options[1].id);
    expectStable();
    act(() => input.dispatchEvent(new Event('input', { bubbles: true })));
    expect(list.scrollTop).toBe(0);
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id);
    expectStable();
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
    const attempts = container.querySelector('.attempts-remaining-label')!;
    expect(player.classList.contains('attempts-remaining-3')).toBe(true);
    expect(status.classList.contains('attempts-remaining-3')).toBe(false);
    expect(attempts.classList.contains('attempts-remaining-3')).toBe(true);

    for (const remaining of [2, 1]) {
      await act(async () => {
        const input = container.querySelector(
          '[role="combobox"]',
        ) as HTMLInputElement;
        input.value = 'Br';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
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
      expect(
        attempts.classList.contains(`attempts-remaining-${remaining}`),
      ).toBe(true);
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
    await act(async () => {
      input.value = 'Br';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
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
    expect(container.textContent).toContain('2 guesses remaining');
    expect(container.textContent).toContain('0 / 0 locations correct');
    expect(
      container.querySelector('[data-map-id]')?.getAttribute('data-map-id'),
    ).toBe('iso:AAA');
    expect(container.querySelector('.active-player')).toBeTruthy();
    expect(container.querySelector('.full-bleed-map')).toBeTruthy();
    expect(
      container.querySelector('[aria-live="assertive"]')?.textContent,
    ).toBe('Incorrect. Try again; the answer is not revealed.');
    expect(
      container.querySelector('.feedback-incorrect .feedback-x-first'),
    ).not.toBeNull();
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
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      'No matches',
    );
    await act(async () => {
      input.value = 'Br';
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
    expect(container.textContent).toContain('2 guesses remaining');
    expect(
      container.querySelector('[aria-live="assertive"]')?.textContent,
    ).toBe(
      'Choose a canonical location from the suggestions or enter its exact name.',
    );
    await act(async () => {
      input.value = 'Al';
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
    expect(
      container.querySelector('.completion-header .quiz-feedback'),
    ).toBeTruthy();
    expect(container.textContent).toContain('Run complete');
    expect(container.querySelector('.active-player')).toBeNull();
    expect(container.querySelector('.full-bleed-map')).toBeNull();
    expect(container.textContent).toContain('50.00%');
    expect(container.textContent).toContain('Score');
    expect(container.querySelector('.result-score strong')?.textContent).toBe(
      '5000',
    );
    expect(
      [...container.querySelectorAll('.results-grid dt')].map(
        (label) => label.textContent,
      ),
    ).toEqual(['Time', 'Accuracy', 'Missed']);
    expect(container.querySelector('.result-mood')?.textContent).toContain(
      'Great work',
    );
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click(),
    );
    expect(container.textContent).toContain('Name every place');
    await act(async () =>
      (container.querySelector('button') as HTMLButtonElement).click(),
    );
    expect(container.textContent).toContain('0 / 0 locations correct');
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
      await act(async () => {
        const input = container.querySelector(
          '[role="combobox"]',
        ) as HTMLInputElement;
        input.value = 'Br';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
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
    expect(
      container.querySelector('.feedback-missed .feedback-x-first'),
    ).not.toBeNull();
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
    expect(container.textContent).toContain('3 guesses remaining');
    expect(container.textContent).toContain('0 / 0 locations correct');
    expect(
      container.querySelector('[data-map-id]')?.getAttribute('data-map-id'),
    ).toBe(firstRunOrder[1]);
    expect(
      container.querySelector('[data-map-id]')?.getAttribute('data-map-id'),
    ).not.toBe(firstRunOrder[0]);
  });
});
