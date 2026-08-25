import { expect, test } from '@playwright/test';

for (const viewport of [
  { name: 'wide', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  for (const [id, label] of [
    ['CA-BC', 'British Columbia'],
    ['CA-PE', 'Prince Edward Island'],
  ]) {
    test(`captures Canada ${label} framing and callout on ${viewport.name}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.goto(`/TerraDash/diagnostics.html?location=${id}`);

      const map = page.locator('.world-map');
      await expect(map).toHaveAttribute('viewBox', '155 0 355 260');
      await expect(map).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
      const active = map.locator(
        `.active-fill path[data-location-id="${id}"]`,
      );
      await expect(active.first()).toHaveAttribute('aria-label', label);
      await expect(active.first()).toBeVisible();
      await active.first().click();
      await expect(map.locator('.callout-inset')).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`canada-${id.toLowerCase()}-${viewport.name}.png`),
        fullPage: true,
      });
    });
  }
}
