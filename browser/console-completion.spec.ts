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
  expect(await page.evaluate(() => window.terraDash?.completeQuiz())).toBe(
    'ignored',
  );
});
