import { expect, test } from '@playwright/test';

const viewports = [
  { name: '561x285', width: 561, height: 285 },
  { name: '769x280', width: 769, height: 280 },
  { name: '375x667', width: 375, height: 667 },
  { name: '1440x900', width: 1440, height: 900 },
];

for (const viewport of viewports) {
  test(`capture spacing evidence at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(
      '/TerraDash/diagnostics.html?quiz=non-un&location=non-un:abkhazia',
    );
    await expect(page.locator('.diagnostics-controls')).toBeVisible();
    await page.evaluate(() => {
      document.activeElement instanceof HTMLElement &&
        document.activeElement.blur();
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });

    const metrics = await page.evaluate(() => {
      const header = document
        .querySelector('.quiz-header')!
        .getBoundingClientRect();
      const prompt = document
        .querySelector('.quiz-prompt-group')!
        .getBoundingClientRect();
      const status = document
        .querySelector('.quiz-status-bar')!
        .getBoundingClientRect();
      const controls = document
        .querySelector('.diagnostics-controls')!
        .getBoundingClientRect();
      const heading = document.querySelector('.quiz-header h1')!;
      const style = getComputedStyle(heading);
      return {
        scrollY: window.scrollY,
        header: {
          x: header.x,
          y: header.y,
          width: header.width,
          height: header.height,
        },
        prompt: {
          x: prompt.x,
          y: prompt.y,
          width: prompt.width,
          height: prompt.height,
        },
        status: {
          x: status.x,
          y: status.y,
          width: status.width,
          height: status.height,
        },
        controls: {
          x: controls.x,
          y: controls.y,
          width: controls.width,
          height: controls.height,
        },
        headerCenter: header.y + header.height / 2,
        controlsCenter: controls.y + controls.height / 2,
        paddingInline: style.paddingInline,
        headingFontSize: style.fontSize,
      };
    });
    console.log(JSON.stringify({ viewport, metrics }));

    if (viewport.name === '769x280') {
      expect(metrics.scrollY).toBe(0);
      expect(metrics.prompt.y + metrics.prompt.height).toBeLessThanOrEqual(
        metrics.controls.y,
      );
      expect(metrics.controls.y + metrics.controls.height).toBeLessThanOrEqual(
        metrics.status.y,
      );
      expect(
        Math.abs(metrics.controlsCenter - metrics.headerCenter),
      ).toBeLessThan(1);
    }

    await page.screenshot({
      path: `test-results/diagnostics-${viewport.name}.png`,
      fullPage: false,
    });
  });
}
