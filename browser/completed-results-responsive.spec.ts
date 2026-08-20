import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 375, height: 667 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
]) {
  test(`completed results fit ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/TerraDash/');
    await page.getByRole('button', { name: 'World UN Countries' }).click();
    await page
      .getByRole('button', { name: 'Start World UN Countries Quiz' })
      .click();
    await expect(page.locator('.active-player')).toBeVisible();
    expect(await page.evaluate(() => window.terraDash?.completeQuiz())).toBe(
      'completed',
    );

    const measurements = await page.evaluate(() => {
      const metrics = document.querySelector<HTMLElement>('.results-grid')!;
      return {
        pageScrollWidth: document.documentElement.scrollWidth,
        pageClientWidth: document.documentElement.clientWidth,
        metricsScrollWidth: metrics.scrollWidth,
        metricsClientWidth: metrics.clientWidth,
        animationName: getComputedStyle(
          document.querySelector<HTMLElement>('.result-mood > span')!,
        ).animationName,
      };
    });
    console.log(JSON.stringify({ viewport, measurements }));
    expect(measurements.pageScrollWidth).toBeLessThanOrEqual(
      measurements.pageClientWidth,
    );
    expect(measurements.metricsScrollWidth).toBeLessThanOrEqual(
      measurements.metricsClientWidth,
    );
    expect(measurements.animationName).toBe('none');
    await expect(page.locator('.result-score')).toBeVisible();
    await expect(page.locator('.results-grid dt').nth(0)).toHaveText('Time');
    await expect(page.locator('.results-grid dt').nth(1)).toHaveText(
      'Accuracy',
    );
    await expect(page.locator('.results-grid dt').nth(2)).toHaveText('Missed');
    await page.screenshot({
      path: testInfo.outputPath(
        `completed-results-${viewport.width}x${viewport.height}.png`,
      ),
      fullPage: true,
    });
  });
}
