import { expect, test, type Page } from 'playwright/test';

const viewports = [
  { width: 375, height: 667 },
  { width: 768, height: 1024 },
];
const runningUnderVitest = Boolean(
  (globalThis as { process?: { env?: { VITEST?: string } } }).process?.env
    ?.VITEST,
);

async function bounds(page: Page, selector: string) {
  return page.locator(selector).boundingBox();
}

function expectSameBounds(
  actual: { x: number; y: number; width: number; height: number } | null,
  expected: { x: number; y: number; width: number; height: number } | null,
) {
  expect(actual).not.toBeNull();
  expect(expected).not.toBeNull();
  expect(actual.x).toBeCloseTo(expected.x, 2);
  expect(actual.y).toBeCloseTo(expected.y, 2);
  expect(actual.width).toBeCloseTo(expected.width, 2);
  expect(actual.height).toBeCloseTo(expected.height, 2);
}

if (!runningUnderVitest) {
  for (const viewport of viewports) {
    test(`quiz and diagnostics map boxes match at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript(() => {
        Math.random = () => 0;
      });
      await page.goto('/TerraDash/?quiz=world&start=1');
      await expect(page.locator('.map-stage')).toBeVisible();

      // A zero RNG makes the first shuffled quiz location deterministic (iso:ALB).
      const mapId = 'iso:ALB';
      const quizBounds = {
        header: await bounds(page, '.quiz-header'),
        stage: await bounds(page, '.map-stage'),
        frame: await bounds(page, '.map-frame'),
        svg: await bounds(page, '.world-map'),
        geometry: await bounds(page, '.active-fill'),
      };

      await page.goto(
        `/TerraDash/diagnostics.html?location=${encodeURIComponent(mapId)}`,
      );
      await expect(page.locator('.diagnostics-control select')).toBeVisible();
      const diagnosticsBounds = {
        header: await bounds(page, '.quiz-header'),
        stage: await bounds(page, '.map-stage'),
        frame: await bounds(page, '.map-frame'),
        svg: await bounds(page, '.world-map'),
        geometry: await bounds(page, '.active-fill'),
      };

      console.log(
        JSON.stringify({
          viewport,
          quiz: quizBounds,
          diagnostics: diagnosticsBounds,
        }),
      );

      for (const key of ['header', 'stage', 'frame', 'svg', 'geometry']) {
        expectSameBounds(diagnosticsBounds[key], quizBounds[key]);
      }

      await expect(page.locator('.map-header-overlay')).toHaveCSS(
        'position',
        'absolute',
      );

      const select = await page
        .locator('.diagnostics-control select')
        .boundingBox();
      expect(select.x + select.width).toBeLessThanOrEqual(viewport.width);
      expect(select.y + select.height).toBeLessThanOrEqual(viewport.height);
    });
  }
}
