import { expect, test } from '@playwright/test';

test('Diagnostics exposes the complete standard and Non-UN location union', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/TerraDash/diagnostics.html');
  const selector = page.getByRole('combobox', { name: 'Location' });
  await expect(selector.locator('option')).toHaveCount(296);

  for (const [id, name] of [
    ['non-un:abkhazia', 'Abkhazia'],
    ['non-un:adjara', 'Adjara'],
  ] as const) {
    await selector.selectOption(id);
    await expect(selector).toHaveValue(id);
    await expect(page.locator('.world-map')).toBeVisible();
    await expect(page.locator('.world-map path')).not.toHaveCount(0);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
  await expect(page.locator('.callout-source')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('diagnostics-custom-adjara.png'),
    fullPage: true,
  });
});
