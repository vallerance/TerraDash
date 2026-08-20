import { expect, test } from '@playwright/test';

test('completes the active quiz through the browser console command', async ({
  page,
}) => {
  await page.goto('/TerraDash/');
  await page.getByRole('button', { name: 'World UN Countries' }).click();
  await page.getByRole('button', { name: 'Start World UN Countries Quiz' }).click();
  await expect(page.locator('.active-player')).toBeVisible();

  const result = await page.evaluate(() => window.terraDash?.completeQuiz());
  expect(result).toBe('completed');
  await expect(
    page.getByRole('heading', { name: 'Run complete' }),
  ).toBeVisible();
  await expect(page.locator('.results-grid')).toContainText(/10:\d{2}/);
  await expect(page.locator('.results-grid')).toContainText('195');
  await expect(page.locator('.app-footer')).toBeVisible();
  expect(await page.locator('.app-footer').evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return rect.bottom <= window.innerHeight + 1;
  })).toBe(true);
  expect(await page.evaluate(() => window.terraDash?.completeQuiz())).toBe(
    'ignored',
  );
});
