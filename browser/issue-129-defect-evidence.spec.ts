import { expect, test } from '@playwright/test';

const base = '/TerraDash/';

for (const viewport of [
  { name: 'wide', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`Canadian Provinces full composition ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto(`${base}?quiz=canadian-provinces&start=1`);
    await expect(page.locator('.active-player')).toBeVisible();
    await expect(page.locator('.world-map')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`canadian-full-${viewport.name}.png`),
      fullPage: true,
    });
  });
}

test('British Columbia and coastal islands remain geographically composed', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${base}diagnostics.html?location=CA-BC`);
  const map = page.locator('.world-map');
  const paths = map.locator('.active-fill path[data-location-id="CA-BC"]');
  await expect(paths).not.toHaveCount(0);
  expect(await paths.count()).toBeGreaterThan(1);
  await page.screenshot({
    path: testInfo.outputPath('canadian-british-columbia-coastal-wide.png'),
    fullPage: true,
  });
});

test('Prince Edward Island magnifier remains visible on mobile', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}diagnostics.html?location=CA-PE`);
  const map = page.locator('.world-map');
  await expect(map.locator('.callout-inset')).toBeVisible();
  await expect(map.locator('.callout-selected path')).not.toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath(
      'canadian-prince-edward-island-magnifier-mobile.png',
    ),
    fullPage: true,
  });
});

test('Newfoundland and Labrador multipart coastal topology stays intact', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto(`${base}diagnostics.html?location=CA-NL`);
  const map = page.locator('.world-map');
  const paths = map.locator('.active-fill path[data-location-id="CA-NL"]');
  await expect(paths).not.toHaveCount(0);
  expect(await paths.count()).toBeGreaterThan(1);
  await page.screenshot({
    path: testInfo.outputPath(
      'canadian-newfoundland-labrador-multipart-tablet.png',
    ),
    fullPage: true,
  });
});
