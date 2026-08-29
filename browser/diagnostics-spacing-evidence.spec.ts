import { expect, test, type Page, type TestInfo } from '@playwright/test';

const state =
  '/TerraDash/diagnostics.html?quiz=non-un&location=non-un:abkhazia';

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await expect(page.locator('.diagnostics-controls')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
  });
}

test('diagnostics spacing before and after evidence', async ({
  page,
}, testInfo) => {
  const viewports = [
    { name: '561x285', width: 561, height: 285 },
    { name: '769x280', width: 769, height: 280 },
    { name: '375x667', width: 375, height: 667 },
    { name: '1440x900', width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(state);
    await capture(page, testInfo, `diagnostics-before-${viewport.name}`);

    await page.addStyleTag({
      content: `
        :root { --content-gutter: clamp(0.65rem, 1.2vw, 1rem); }
        .quiz-header h1 { font-size: clamp(1rem, 1.35vw, 1.15rem); }
        @media (max-width: 620px) {
          .quiz-header:has(.diagnostics-controls) > .map-header-overlay { min-height: 0; }
        }
        @media (min-width: 621px) and (max-width: 900px) {
          .quiz-header:has(.diagnostics-controls) > .map-header-overlay { min-height: 0; }
        }
      `,
    });
    await capture(
      page,
      testInfo,
      `diagnostics-before-baseline-${viewport.name}`,
    );
    await page.reload();
    await expect(page.locator('.diagnostics-controls')).toBeVisible();
    await capture(page, testInfo, `diagnostics-after-${viewport.name}`);

    if (viewport.width === 561) {
      const values = await page.evaluate(() => {
        const header = document.querySelector<HTMLElement>('.quiz-header')!;
        const heading = document.querySelector<HTMLElement>('.quiz-header h1')!;
        const style = getComputedStyle(header);
        return {
          paddingInline: style.paddingInline,
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
      const centers = await page.evaluate(() => {
        const rect = (selector: string) =>
          document
            .querySelector<HTMLElement>(selector)!
            .getBoundingClientRect();
        const controls = rect('.diagnostics-controls');
        const header = rect('.quiz-header');
        return {
          controlsCenter: (controls.top + controls.bottom) / 2,
          headerCenter: (header.top + header.bottom) / 2,
        };
      });
      console.log(`769px measured centers: ${JSON.stringify(centers)}`);
      expect(
        Math.abs(centers.controlsCenter - centers.headerCenter),
      ).toBeLessThanOrEqual(1);
    }
  }
});
