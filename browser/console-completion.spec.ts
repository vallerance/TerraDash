import { expect, test } from '@playwright/test';

test('completes the active quiz through the browser console command', async ({
  page,
}) => {
  await page.goto('/TerraDash/');
  await page.getByRole('button', { name: 'World UN Countries' }).click();
  await page.getByRole('button', { name: 'Start World UN Countries' }).click();
  await expect(page.locator('.active-player')).toBeVisible();

  const result = await page.evaluate(() => window.terraDash?.completeQuiz());
  expect(result).toBe('completed');
  await expect(
    page.getByRole('heading', { name: 'Run complete' }),
  ).toBeVisible();
  await expect(page.locator('.results-grid')).toContainText(/10:\d{2}/);
  await expect(page.locator('.results-grid')).toContainText('195');
  await expect(
    page.getByRole('heading', { name: 'High Score Achieved' }),
  ).toBeVisible();
  await expect(
    page.locator('.high-score-achieved .high-score-table thead'),
  ).toContainText('Score');
  await expect(
    page.locator('.high-score-achieved .high-score-table thead'),
  ).toContainText('Accuracy');
  await expect(
    page.locator('.high-score-achieved .high-score-table thead'),
  ).toContainText('Time');
  await expect(
    page.locator('.high-score-panel .high-score-table tbody tr'),
  ).toHaveCount(1);
  const resultChildren = page.locator('.quiz-results > *');
  const childClasses = await resultChildren.evaluateAll((elements) =>
    elements.map((element) => element.className),
  );
  expect(childClasses.indexOf('results-grid')).toBeLessThan(
    childClasses.indexOf('high-score-achieved'),
  );
  expect(childClasses.indexOf('high-score-achieved')).toBeLessThan(
    childClasses.indexOf('high-score-panel'),
  );
  expect(childClasses.indexOf('high-score-panel')).toBeLessThan(
    childClasses.indexOf('primary-action'),
  );
  expect(await page.evaluate(() => window.terraDash?.completeQuiz())).toBe(
    'ignored',
  );
});
