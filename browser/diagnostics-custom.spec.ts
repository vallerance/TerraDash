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
  { name: 'reported-wide', width: 801, height: 219 },
  { name: 'reported-narrow', width: 645, height: 195 },
  { name: 'tablet', width: 768, height: 1024 },
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
      const h = header.getBoundingClientRect();
      const c = controls.getBoundingClientRect();
      return {
        controlsInsideHeader: c.left >= h.left && c.right <= h.right,
        controlsVerticallyInsideHeader: c.top >= h.top && c.bottom <= h.bottom,
        horizontalOverflow:
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      };
    });
    expect(bounds).toEqual({
      controlsInsideHeader: true,
      controlsVerticallyInsideHeader: true,
      horizontalOverflow: true,
    });
    await page.screenshot({
      path: testInfo.outputPath(`diagnostics-controls-${viewport.name}.png`),
      fullPage: true,
    });
  });
}
