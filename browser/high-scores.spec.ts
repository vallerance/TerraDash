import { expect, test } from '@playwright/test';

test('global high scores expose accessible score, accuracy, and time columns', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'terradash.high-scores.v1',
      JSON.stringify({
        version: 1,
        playerName: 'Explorer',
        scores: {
          world: [
            {
              id: 'fixture-entry',
              username: 'Explorer',
              score: 875,
              accuracy: 0.875,
              elapsedMs: 12_000,
              createdAt: 7,
            },
          ],
        },
      }),
    );
  });
  await page.goto('/TerraDash/?page=high-scores');
  const table = page.locator('.high-score-table').first();
  await expect(table.locator('thead th')).toHaveText([
    'Player',
    'Score',
    'Accuracy',
    'Time',
  ]);
  await expect(table.locator('tbody tr')).toContainText('Explorer');
  await expect(table.locator('tbody tr')).toContainText('875');
  await expect(table.locator('tbody tr')).toContainText('87.50%');
  await expect(table.locator('tbody tr')).toContainText('0:12');
});
