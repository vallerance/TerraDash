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
      map.locator('.map-base-layers [data-layer-id="CN-GX"]'),
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

test('keeps Beijing playable while excluded Guangxi remains non-targetable', async ({
  page,
}) => {
  await page.goto('/TerraDash/diagnostics.html?location=CN-BJ');
  const target = page.locator('.active-fill path[data-location-id="CN-BJ"]');
  await expect(target.first()).toHaveAttribute('aria-label', 'Beijing');
  await expect(target.first()).toHaveAttribute('role', 'button');

  await page.goto('/TerraDash/?quiz=china-provinces&start=1');
  await expect(page.locator('.quiz-name')).toHaveText('China Provinces');
  await expect(page.locator('.quiz-prompt-group')).toBeVisible();
  const answer = page.getByRole('combobox', { name: 'Location name' });
  await answer.fill('Bei');
  await expect(page.getByRole('option', { name: 'Beijing' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Guangxi' })).toHaveCount(0);
  await page.getByRole('option', { name: 'Beijing' }).click();
  await page.getByRole('button', { name: 'Submit answer' }).click();
  await expect(page.locator('.status-correct strong')).toHaveText('1/1');
  await expect(page.locator('.status-remaining strong')).toHaveText('25');
});
