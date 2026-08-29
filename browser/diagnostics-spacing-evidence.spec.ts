import { expect, test, type Page, type TestInfo } from '@playwright/test';

const state =
  '/TerraDash/diagnostics.html?quiz=non-un&location=non-un:abkhazia';

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await expect(page.locator('.diagnostics-controls')).toBeVisible();
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
  });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
}

test('captures contained diagnostics spacing evidence', async ({
  page,
}, testInfo) => {
  for (const viewport of [
    { name: '561x285', width: 561, height: 285 },
    { name: '769x280', width: 769, height: 280 },
    { name: '375x667', width: 375, height: 667 },
    { name: '1440x900', width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(state);
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });

    if (viewport.width === 561) {
      const values = await page.evaluate(() => {
        const header = document.querySelector<HTMLElement>(
          '.active-player .quiz-header',
        )!;
        const heading = document.querySelector<HTMLElement>(
          '.active-player .quiz-header h1',
        )!;
        return {
          paddingInline: getComputedStyle(header).paddingInline,
          headingFontSize: getComputedStyle(heading).fontSize,
        };
      });
      console.log(`561px computed values: ${JSON.stringify(values)}`);
      expect(values).toEqual({
        paddingInline: '12.8px',
        headingFontSize: '14.4px',
      });
    }

    if (viewport.width === 769) {
      const bounds = await page.evaluate(() => {
        const rect = (selector: string) =>
          document
            .querySelector<HTMLElement>(`.active-player ${selector}`)!
            .getBoundingClientRect();
        const prompt = rect('.quiz-prompt-group');
        const status = rect('.quiz-status-bar');
        const controls = rect('.diagnostics-controls');
        const header = rect('.quiz-header');
        const overlaps = (a: DOMRect, b: DOMRect) =>
          a.left < b.right &&
          a.right > b.left &&
          a.top < b.bottom &&
          a.bottom > b.top;
        return {
          controlsCenter: (controls.top + controls.bottom) / 2,
          headerCenter: (header.top + header.bottom) / 2,
          promptControlsOverlap: overlaps(prompt, controls),
          statusControlsOverlap: overlaps(status, controls),
        };
      });
      console.log(`769px measured layout: ${JSON.stringify(bounds)}`);
      expect(bounds.promptControlsOverlap).toBe(false);
      expect(bounds.statusControlsOverlap).toBe(false);
    }

    await capture(page, testInfo, `diagnostics-after-${viewport.name}`);
  }
});
