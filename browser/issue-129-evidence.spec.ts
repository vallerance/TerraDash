import { expect, test } from '@playwright/test';

const base = '/TerraDash/';

for (const viewport of [
  { name: 'wide', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`Canadian Provinces full quiz ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto(`${base}?quiz=canadian-provinces&start=1`);
    await expect(page.locator('.active-player')).toBeVisible();
    await expect(page.locator('.world-map')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`canadian-provinces-full-${viewport.name}.png`),
      fullPage: true,
    });
  });
}

test('Prince Edward Island magnifier topology', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${base}diagnostics.html?location=CA-PE`);
  const map = page.locator('.world-map');
  await expect(map.locator('.callout-inset')).toBeVisible();
  await expect(map.locator('.callout-selected path')).not.toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('canadian-pei-magnifier-wide.png'), fullPage: true });
});

test('Newfoundland and Labrador multipart coastal topology', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto(`${base}diagnostics.html?location=CA-NL`);
  const map = page.locator('.world-map');
  const mainPaths = map.locator('.active-fill path[data-location-id="CA-NL"]');
  await expect(mainPaths).not.toHaveCount(0);
  expect(await mainPaths.count()).toBeGreaterThan(1);
  await expect(map.locator('.callout-inset .callout-selected path')).not.toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('canadian-newfoundland-labrador-multipart.png'), fullPage: true });
});

test('Canadian quiz normal answer and advance flow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${base}?quiz=canadian-provinces&start=1`);
  const target = page.locator('.world-map .active-fill path[data-location-id]').first();
  const targetName = await target.getAttribute('aria-label');
  expect(targetName).toBeTruthy();
  await page.getByRole('combobox', { name: 'Location name' }).fill(targetName!);
  await page.getByRole('button', { name: 'Submit answer' }).click();
  await expect(page.locator('.status-correct strong')).toHaveText('1/1');
  await page.screenshot({ path: testInfo.outputPath('canadian-answer-and-advance.png'), fullPage: true });
});
