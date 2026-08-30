import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const locations = JSON.parse(
  readFileSync(
    new URL('../data/generated/locations.json', import.meta.url),
    'utf8',
  ),
);

test('diagnostics uses the shared quiz player and scopes its controls', async ({
  page,
}) => {
  await page.goto(
    '/TerraDash/diagnostics.html?quiz=non-un&location=non-un:abkhazia',
  );
  const controls = page.locator('.diagnostics-controls');
  const quizSelect = controls.locator('#diagnostic-quiz');
  const locationSelect = controls.locator('#diagnostic-location');
  await expect(quizSelect).toHaveValue('non-un');
  await expect(locationSelect).toHaveValue('non-un:abkhazia');
  await expect(locationSelect.locator('option')).toHaveCount(89);
  await expect(page.locator('#answer')).toBeVisible();
  await expect(page.locator('.active-fill path')).not.toHaveCount(0);
  await expect(page.locator('.callout-selected path')).not.toHaveCount(0);

  const firstLocation = await locationSelect.inputValue();
  const nextLocation = await locationSelect
    .locator('option')
    .nth(1)
    .getAttribute('value');
  await locationSelect.selectOption(nextLocation!);
  await expect(locationSelect).toHaveValue(nextLocation!);
  await expect(locationSelect).not.toHaveValue(firstLocation);

  await page
    .locator('#answer')
    .fill((await locationSelect.locator('option:checked').textContent()) ?? '');
  await page.locator('#answer').press('Enter');
  await expect(locationSelect).not.toHaveValue(nextLocation!);

  await quizSelect.selectOption('us-states');
  await expect(quizSelect).toHaveValue('us-states');
  await expect(locationSelect.locator('option')).toHaveCount(51);
  await quizSelect.selectOption('non-un');
  await expect(locationSelect.locator('option')).toHaveCount(89);

  await page.evaluate(() =>
    localStorage.setItem('terradash.high-scores.v1', '{"sentinel":true}'),
  );
  await controls.getByRole('button', { name: 'End Quiz' }).click();
  await expect(page.locator('.quiz-results')).toBeVisible();
  await expect(page.locator('.high-score-panel')).toHaveCount(0);
  const storedScores = await page.evaluate(() =>
    localStorage.getItem('terradash.high-scores.v1'),
  );
  expect(storedScores).toBe('{"sentinel":true}');
});

test('diagnostics quiz switching never renders the quiz home transition', async ({
  page,
}) => {
  await page.goto('/TerraDash/diagnostics.html?quiz=non-un');
  await expect(page.locator('#diagnostic-quiz')).toHaveValue('non-un');
  await page.evaluate(() => {
    let homeSeen = Boolean(document.querySelector('.home-page'));
    const observer = new MutationObserver(() => {
      homeSeen ||= Boolean(document.querySelector('.home-page'));
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 1000);
    Object.defineProperty(window, '__diagnosticsHomeSeen', {
      configurable: true,
      get: () => homeSeen,
    });
  });

  await page.locator('#diagnostic-quiz').selectOption('us-states');
  await expect(page.locator('#diagnostic-quiz')).toHaveValue('us-states');
  await expect(page.locator('.active-player')).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __diagnosticsHomeSeen?: boolean })
          .__diagnosticsHomeSeen,
    ),
  ).toBe(false);
});

for (const viewport of [
  { name: 'reported-exact', width: 1495, height: 922 },
  { name: 'reported-narrow', width: 769, height: 280 },
  { name: 'reported-wide', width: 1677, height: 486 },
  { name: 'containment-tablet', width: 649, height: 463 },
  { name: 'mobile', width: 375, height: 667 },
]) {
  test(`diagnostics controls remain contained and centered at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/TerraDash/diagnostics.html?quiz=non-un');
    await expect(page.locator('.diagnostics-controls')).toBeVisible();
    const bounds = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>('.quiz-header')!;
      const controls = document.querySelector<HTMLElement>(
        '.diagnostics-controls',
      )!;
      const quiz = controls.querySelector<HTMLElement>('#diagnostic-quiz')!;
      const location = controls.querySelector<HTMLElement>(
        '#diagnostic-location',
      )!;
      const endQuiz = controls.querySelector<HTMLElement>('button')!;
      const prompt = document.querySelector<HTMLElement>('.quiz-prompt')!;
      const status = document.querySelector<HTMLElement>('.quiz-status-bar')!;
      const statusItems = [
        ...document.querySelectorAll<HTMLElement>(
          '.quiz-status-bar .status-item',
        ),
      ];
      const h = header.getBoundingClientRect();
      const c = controls.getBoundingClientRect();
      const center = (rect: DOMRect) => (rect.top + rect.bottom) / 2;
      const intersects = (a: DOMRect, b: DOMRect) =>
        a.left < b.right &&
        a.right > b.left &&
        a.top < b.bottom &&
        a.bottom > b.top;
      const rectanglesOverlap = (items: HTMLElement[]) =>
        items.some((item, index) =>
          items
            .slice(index + 1)
            .some((other) =>
              intersects(
                item.getBoundingClientRect(),
                other.getBoundingClientRect(),
              ),
            ),
        );
      return {
        controlsInsideHeader: c.left >= h.left && c.right <= h.right,
        controlsVerticallyInsideHeader: c.top >= h.top && c.bottom <= h.bottom,
        elementCenters: {
          quiz: center(quiz.getBoundingClientRect()),
          location: center(location.getBoundingClientRect()),
          endQuiz: center(endQuiz.getBoundingClientRect()),
        },
        elementEdges: [quiz, location, endQuiz].map((element) => {
          const rect = element.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom, height: rect.height };
        }),
        endQuizClipped:
          endQuiz.scrollWidth > endQuiz.clientWidth ||
          endQuiz.scrollHeight > endQuiz.clientHeight,
        headerCenter: center(h),
        controlsCenter: center(c),
        promptControlIntersection: intersects(
          prompt.getBoundingClientRect(),
          c,
        ),
        statusControlIntersection: intersects(
          status.getBoundingClientRect(),
          c,
        ),
        statusItemsOverlap: rectanglesOverlap(statusItems),
        horizontalOverflow:
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      };
    });
    expect(bounds.controlsInsideHeader).toBe(true);
    expect(bounds.controlsVerticallyInsideHeader).toBe(true);
    expect(bounds.endQuizClipped).toBe(false);
    if (viewport.width >= 901) {
      expect(
        Math.abs(bounds.controlsCenter - bounds.headerCenter),
      ).toBeLessThanOrEqual(0.5);
    }
    expect(bounds.horizontalOverflow).toBe(true);
    expect(bounds.promptControlIntersection).toBe(false);
    expect(bounds.statusControlIntersection).toBe(false);
    expect(bounds.statusItemsOverlap).toBe(false);
    const centers = Object.values(bounds.elementCenters);
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(
      0.5,
    );
    expect(
      Math.max(...bounds.elementEdges.map(({ top }) => top)) -
        Math.min(...bounds.elementEdges.map(({ top }) => top)),
    ).toBeLessThanOrEqual(0.5);
    expect(
      Math.max(...bounds.elementEdges.map(({ bottom }) => bottom)) -
        Math.min(...bounds.elementEdges.map(({ bottom }) => bottom)),
    ).toBeLessThanOrEqual(0.5);
    await page.screenshot({
      path: testInfo.outputPath(`diagnostics-controls-${viewport.name}.png`),
      fullPage: true,
    });
  });
}
