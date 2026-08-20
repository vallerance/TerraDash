import { expect, test } from '@playwright/test';

const nonUnTitle =
  'Non-UN Countries, Independent Territories, and Autonomous Regions';

test('navbar navigation is same-document and preserves deep-link history', async ({
  page,
}) => {
  let loadCount = 0;
  page.on('load', () => loadCount++);
  await page.goto('/TerraDash/');
  const initialLoadCount = loadCount;

  await page.getByRole('link', { name: 'Diagnostics' }).click();
  await expect(page).toHaveURL(/\/TerraDash\/diagnostics\.html$/);
  await expect(page.locator('.diagnostics-control select')).toBeVisible();
  expect(loadCount).toBe(initialLoadCount);

  await page.getByRole('button', { name: /Quizzes/ }).click();
  await page.getByRole('menuitem', { name: 'World' }).click();
  await expect(page).toHaveURL(/\/TerraDash\/\?quiz=world&select=1$/);
  await expect(
    page.getByRole('dialog', { name: 'World UN Countries' }),
  ).toBeVisible();
  expect(loadCount).toBe(initialLoadCount);

  await page.goBack();
  await expect(page).toHaveURL(/\/TerraDash\/diagnostics\.html$/);
  await expect(page.locator('.diagnostics-control select')).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole('dialog', { name: 'World UN Countries' }),
  ).toBeVisible();
  expect(loadCount).toBe(initialLoadCount);

  await page
    .getByRole('dialog', { name: 'World UN Countries' })
    .getByRole('button', { name: 'Close quiz details' })
    .click();
  await page.getByRole('link', { name: 'High Scores' }).click();
  await expect(page).toHaveURL(/\/TerraDash\/\?page=high-scores$/);
  await expect(
    page.getByRole('heading', { name: 'High Scores' }),
  ).toBeVisible();
  expect(loadCount).toBe(initialLoadCount);
});

test('dropdown uses readable controls and wraps the full Non-UN title', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/TerraDash/');
  await page.getByRole('button', { name: /Quizzes/ }).click();
  const item = page.getByRole('menuitem', { name: nonUnTitle });
  await expect(item).toBeVisible();
  const metrics = await item.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      height: box.height,
      width: box.width,
      fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
      lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
    };
  });
  expect(metrics.fontSize).toBeGreaterThanOrEqual(12);
  expect(metrics.height).toBeGreaterThan(metrics.lineHeight * 1.5);
  expect(metrics.width).toBeLessThanOrEqual(343);
});
