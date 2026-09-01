import { expect, test, type Page } from '@playwright/test';

type Geometry = {
  viewport: { width: number; height: number };
  shell: { width: number; height: number };
  stage: { width: number; height: number };
  frame: { width: number; height: number };
  overflow: boolean;
};

async function readGeometry(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector)!;
      const bounds = element.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    };
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      shell: rect('main.app-shell'),
      stage: rect('.map-stage'),
      frame: rect('.map-frame'),
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
}

async function waitForGeometryChange(page: Page, previous: Geometry) {
  await page.waitForFunction(
    ({ previousWidth, previousHeight }) => {
      const stage = document.querySelector<HTMLElement>('.map-stage');
      const frame = document.querySelector<HTMLElement>('.map-frame');
      if (!stage || !frame) return false;
      const stageBounds = stage.getBoundingClientRect();
      const frameBounds = frame.getBoundingClientRect();
      return (
        (stageBounds.width !== previousWidth ||
          stageBounds.height !== previousHeight) &&
        frameBounds.width > 0 &&
        frameBounds.height > 0 &&
        frameBounds.right <= window.innerWidth + 1 &&
        frameBounds.bottom <= window.innerHeight + 1 &&
        document.documentElement.scrollWidth <= window.innerWidth
      );
    },
    {
      previousWidth: previous.stage.width,
      previousHeight: previous.stage.height,
    },
  );
}

test('one open quiz recomputes map geometry in both resize directions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/TerraDash/?quiz=world&start=1');
  await expect(page.locator('.active-player')).toBeVisible();
  await expect(page.locator('.world-map')).toBeVisible();

  const wide = await readGeometry(page);
  expect(wide.overflow).toBe(false);

  await page.setViewportSize({ width: 375, height: 667 });
  await waitForGeometryChange(page, wide);
  const narrow = await readGeometry(page);
  expect(narrow.overflow).toBe(false);
  expect(narrow.stage.width).toBeLessThan(wide.stage.width);
  expect(narrow.frame.width).toBeLessThan(wide.frame.width);

  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForGeometryChange(page, narrow);
  const restored = await readGeometry(page);
  expect(restored.overflow).toBe(false);
  expect(restored.stage.width).toBeGreaterThan(narrow.stage.width);
  expect(restored.frame.width).toBeGreaterThan(narrow.frame.width);
});
