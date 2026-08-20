import { expect, test } from '@playwright/test';

test('diagnostics exposes and renders a custom exact geometry', async ({
  page,
}) => {
  await page.goto('/TerraDash/diagnostics.html?location=non-un:abkhazia');
  const select = page.locator('.diagnostics-control select');
  await expect(select).toHaveValue('non-un:abkhazia');
  await expect(select.locator('option')).toHaveCount(279);
  await expect(page.locator('.diagnostics-selected-name')).toHaveText(
    'Abkhazia',
  );
  await expect(page.locator('.active-fill path')).not.toHaveCount(0);
  await expect(page.locator('.callout-selected path')).not.toHaveCount(0);
});
