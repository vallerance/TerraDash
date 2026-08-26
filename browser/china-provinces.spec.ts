import { expect, test } from '@playwright/test';

const viewBox = '920 125 432.72727272727275 190.1';

for (const viewport of [
  { name: 'wide', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`captures China composition and Hainan island context on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/TerraDash/diagnostics.html?location=CN-HI');
    const map = page.locator('.world-map');
    await expect(map).toHaveAttribute('viewBox', viewBox);
    await expect(map.locator('.countries [data-feature-id]')).not.toHaveCount(
      0,
    );
    await expect(map.locator('.map-base-layers [data-layer-id]')).toHaveCount(
      31,
    );
    await expect(
      map.locator('.map-base-layers [data-layer-id="CN-BJ"]'),
    ).toBeVisible();
    await expect(
      map.locator('.map-base-layers [data-layer-id="CN-XZ"]'),
    ).toBeVisible();
    const active = map.locator('.active-fill path[data-location-id="CN-HI"]');
    await expect(active).toHaveAttribute('aria-label', 'Hainan');
    await expect(active.first()).toBeVisible();
    const mapBox = await map.boundingBox();
    const activeBox = await active.first().boundingBox();
    expect(mapBox).not.toBeNull();
    expect(activeBox).not.toBeNull();
    expect(activeBox!.x + activeBox!.width).toBeGreaterThan(mapBox!.x);
    expect(activeBox!.x).toBeLessThan(mapBox!.x + mapBox!.width);
    expect(activeBox!.y + activeBox!.height).toBeGreaterThan(mapBox!.y);
    expect(activeBox!.y).toBeLessThan(mapBox!.y + mapBox!.height);
    await page.screenshot({
      path: testInfo.outputPath(`china-provinces-${viewport.name}.png`),
      fullPage: true,
    });
  });
}
