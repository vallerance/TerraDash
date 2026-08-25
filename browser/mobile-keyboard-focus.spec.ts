import { expect, test } from '@playwright/test';

for (const fixture of [
  { name: 'wide-mobile', width: 430, height: 932 },
  { name: 'tall-mobile', width: 375, height: 812 },
]) {
  test(`active quiz focus and layout remain stable at ${fixture.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: fixture.width, height: fixture.height });
    await page.goto('/TerraDash/?quiz=world&start=1');

    const input = page.getByRole('combobox', { name: 'Location name' });
    await expect(input).toBeFocused();
    await input.fill('a');
    const currentId = await page
      .locator('[data-map-id]')
      .getAttribute('data-map-id');
    const wrongId = await page
      .locator('[role="option"]')
      .evaluateAll((options, activeId) => {
        const option = options.find(
          (candidate) => candidate.id !== `answer-option-${activeId}`,
        );
        return option?.id.replace(/^answer-option-/, '');
      }, currentId);
    expect(wrongId).toBeTruthy();
    await page.locator(`#answer-option-${wrongId}`).click();
    await page.getByRole('button', { name: 'Submit answer' }).click();
    await expect(input).toBeFocused();

    const beforeResize = await page.locator('main.app-shell').boundingBox();
    expect(beforeResize).not.toBeNull();
    await page.setViewportSize({ width: fixture.width, height: 520 });
    const afterResize = await page.locator('main.app-shell').boundingBox();
    expect(afterResize).not.toBeNull();
    expect(afterResize!.height).toBeCloseTo(beforeResize!.height, 0);

    await page.screenshot({
      path: testInfo.outputPath(`active-keyboard-${fixture.name}.png`),
      fullPage: true,
    });
  });
}
