import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const cases = [
  { name: '649x463', width: 649, height: 463 },
  { name: '1677x486', width: 1677, height: 486 },
];

const beforeCss = `
  :root { --content-gutter: clamp(0.65rem, 1.2vw, 1rem); }
  .quiz-header:has(.diagnostics-controls) { padding-inline: 0.65rem !important; }
  .quiz-header:has(.diagnostics-controls) h1 { font-size: clamp(1rem, 1.5vw, 1.3rem) !important; }
  @media (min-width: 901px) {
    .quiz-header:has(.diagnostics-controls) { display: flex !important; grid-template-columns: none !important; }
    .quiz-header:has(.diagnostics-controls) > .quiz-prompt-group,
    .quiz-header:has(.diagnostics-controls) > .quiz-status-bar { width: 100% !important; }
    .quiz-header:has(.diagnostics-controls) > .map-header-overlay { right: 0 !important; left: 0 !important; width: auto !important; padding: 0.55rem var(--content-gutter) !important; }
    .quiz-header:has(.diagnostics-controls) > .map-header-overlay > * { width: clamp(8rem, 28vw, 14rem) !important; max-width: 40% !important; }
  }
`;

for (const viewport of cases) {
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
        const controls = header.querySelector<HTMLElement>('.diagnostics-controls')!;
        const heading = header.querySelector<HTMLElement>('h1')!;
        const status = header.querySelector<HTMLElement>('.quiz-status-bar')!;
        const rect = (element: HTMLElement) => element.getBoundingClientRect().toJSON();
        return {
          padding: getComputedStyle(header).paddingLeft,
          fontSize: getComputedStyle(heading).fontSize,
          header: rect(header),
          prompt: rect(prompt),
          controls: rect(controls),
          status: rect(status),
        };
      });

    await page.addStyleTag({ content: beforeCss });
    const before = await measure();
    await page.screenshot({ path: testInfo.outputPath(`diagnostics-before-${viewport.name}.png`), fullPage: true });
    await page.locator('style').last().evaluate((style) => style.remove());
    const after = await measure();
    await page.screenshot({ path: testInfo.outputPath(`diagnostics-after-${viewport.name}.png`), fullPage: true });
    writeFileSync(testInfo.outputPath(`diagnostics-spacing-${viewport.name}.json`), JSON.stringify({ viewport, before, after }, null, 2));
  });
}
