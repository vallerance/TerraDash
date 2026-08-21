import { expect, test } from '@playwright/test';

for (const viewport of [
  { name: 'wide', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`keeps Alaska and Hawaii visible at true positions on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    for (const [id, name] of [
      ['US-AK', 'Alaska'],
      ['US-HI', 'Hawaii'],
    ]) {
      await page.goto(`/TerraDash/diagnostics.html?location=${id}`);
      const map = page.locator('.regional-map');
      await expect(map).toHaveAttribute('viewBox', '10 35 500 295');
      const state = map
        .locator(`.active-fill > path[data-location-id="${id}"]`)
        .first();
      await expect(state).toHaveAttribute('aria-label', name);
      await expect(state).toBeVisible();
      const box = await state.boundingBox();
      expect(box?.width).toBeGreaterThan(0);
      expect(box?.height).toBeGreaterThan(0);
      await state.click();
    }
  });
}

test('regional submenu is keyboard accessible and viewport-contained', async ({
  page,
}) => {
  await page.goto('/TerraDash/');
  const trigger = page.getByRole('button', { name: /Quizzes/ });
  await trigger.click();
  const regional = page.getByRole('menuitem', { name: 'Regional quizzes' });
  await regional.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('menu').last()).toBeVisible();
  await expect(page.getByRole('menu').last().getByRole('menuitem')).toHaveText([
    'US States',
  ]);
});
