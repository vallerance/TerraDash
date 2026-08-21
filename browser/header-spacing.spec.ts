import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'wide', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 },
];

const surfaces = [
  {
    name: 'home',
    path: '/TerraDash/',
    selector: '.home-page',
  },
  {
    name: 'active-quiz',
    path: '/TerraDash/?quiz=world&start=1',
    selector: '.active-player',
  },
  {
    name: 'diagnostics',
    path: '/TerraDash/diagnostics.html?location=iso:ALB',
    selector: '.active-player',
  },
];

for (const viewport of viewports) {
  for (const surface of surfaces) {
    test(`shared header spacing ${surface.name} ${viewport.name}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.goto(surface.path);
      await expect(page.locator(surface.selector)).toBeVisible();

      const spacing = await page.evaluate((contentSelector) => {
        const header = document.querySelector<HTMLElement>('.app-header')!;
        const content = document.querySelector<HTMLElement>(contentSelector)!;
        const headerRect = header.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        const root = getComputedStyle(document.documentElement);
        const gap = parseFloat(root.getPropertyValue('--map-stage-header-gap'));
        const rem = parseFloat(root.fontSize);
        return {
          renderedGap: contentRect.top - headerRect.bottom,
          expectedGap: gap * rem,
          headerBottom: headerRect.bottom,
          contentTop: contentRect.top,
        };
      }, surface.selector);

      expect(spacing.renderedGap).toBeCloseTo(spacing.expectedGap, 1);
      expect(spacing.renderedGap).toBeGreaterThan(0);
      await page.screenshot({
        path: testInfo.outputPath(
          `header-spacing-${surface.name}-${viewport.name}.png`,
        ),
        fullPage: true,
      });
    });
  }
}
