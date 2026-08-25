import { expect, test } from '@playwright/test';

const visibleContext = [
  'ne:1159321369',
  'ne:1159320707',
  'ne:1159321091',
  'ne:1159321055',
  'ne:1159320931',
  'ne:1159320827',
  'ne:1159320815',
  'ne:1159321253',
  'ne:1159320527',
  'ne:1159320517',
  'ne:1159320431',
  'ne:1159320415',
];

for (const viewport of [
  { name: 'wide', width: 1905, height: 952 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`captures complete Mexico surrounding context at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/TerraDash/diagnostics.html?location=MX-DIF');
    const map = page.locator('.world-map');
    await expect(map).toHaveAttribute('viewBox', '198 216 224 98');
    for (const featureId of visibleContext) {
      await expect(
        map.locator(`.countries [data-feature-id="${featureId}"] path`).first(),
      ).toHaveCount(1);
    }
    await expect(
      map.locator('.active-fill path[data-location-id="MX-DIF"]'),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`mexico-context-coverage-${viewport.name}.png`),
      fullPage: true,
    });
  });
}

for (const [locationId, slug] of [
  ['US-RI', 'us-rhode-island'],
  ['CA-PE', 'ca-prince-edward-island'],
] as const) {
  test(`preserves default retained context fallback for ${locationId}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/TerraDash/diagnostics.html?location=${locationId}`);
    await expect(
      page
        .locator(`.active-fill path[data-location-id="${locationId}"]`)
        .first(),
    ).toBeVisible();
    await expect(
      page.locator('.countries [data-feature-id]').first(),
    ).toHaveCount(1);
    await page.screenshot({
      path: testInfo.outputPath(`${slug}-context-fallback-mobile.png`),
      fullPage: true,
    });
  });
}
