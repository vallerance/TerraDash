import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const viewports = [
  { name: '649x463', width: 649, height: 463 },
  { name: '1677x486', width: 1677, height: 486 },
];

for (const viewport of viewports) {
  test(`captures diagnostics spacing before and after at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/TerraDash/diagnostics.html?location=iso:ALB');
    await expect(page.locator('.diagnostics-controls')).toBeVisible();
    const measure = () =>
      page.evaluate(() => {
        const header = document.querySelector<HTMLElement>('.quiz-header')!;
        const prompt = header.querySelector<HTMLElement>('.quiz-prompt')!;
        const controls = header.querySelector<HTMLElement>(
          '.diagnostics-controls',
        )!;
        const heading = header.querySelector<HTMLElement>('h1')!;
        const status = header.querySelector<HTMLElement>('.quiz-status-bar')!;
        const rect = (element: HTMLElement) =>
          element.getBoundingClientRect().toJSON();
        return {
          padding: getComputedStyle(header).paddingLeft,
          fontSize: getComputedStyle(heading).fontSize,
          prompt: rect(prompt),
          controls: rect(controls),
          status: rect(status),
        };
      });
    await page.addStyleTag({
      content: `
      .quiz-header:has(.diagnostics-controls) { padding-inline: 0.65rem !important; }
      .quiz-header:has(.diagnostics-controls) h1 { font-size: clamp(1rem, 1.5vw, 1.3rem) !important; }
    `,
    });
    const before = await measure();
    await page.screenshot({
      path: testInfo.outputPath(`diagnostics-before-${viewport.name}.png`),
      fullPage: true,
    });
    await page
      .locator('style')
      .last()
      .evaluate((style) => style.remove());
    const after = await measure();
    await page.screenshot({
      path: testInfo.outputPath(`diagnostics-after-${viewport.name}.png`),
      fullPage: true,
    });
    writeFileSync(
      testInfo.outputPath(`diagnostics-spacing-${viewport.name}.json`),
      JSON.stringify({ viewport, before, after }, null, 2),
    );
  });
}
