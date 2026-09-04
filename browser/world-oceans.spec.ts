import { expect, test } from '@playwright/test';

const oceanCases = [
  ['arctic-ocean', 'Arctic Ocean'],
  ['atlantic-ocean', 'Atlantic Ocean'],
  ['indian-ocean', 'Indian Ocean'],
  ['pacific-ocean', 'Pacific Ocean'],
  ['southern-ocean', 'Southern Ocean'],
] as const;

const continentCases = [
  ['africa', 'Africa'],
  ['europe', 'Europe'],
  ['asia', 'Asia'],
  ['north-america', 'North America'],
  ['south-america', 'South America'],
  ['oceania', 'Oceania'],
] as const;

function diagnosticsUrl(slug: string) {
  return `/TerraDash/diagnostics.html?quiz=continents-and-oceans&location=${encodeURIComponent(`world:${slug}`)}`;
}

test('each ocean has an open-water clickable representative', async ({
  page,
}) => {
  for (const [slug, name] of oceanCases) {
    await page.goto(diagnosticsUrl(slug));
    const ocean = page.locator(
      `.active-fill path[data-location-id="world:${slug}"]`,
    );
    await expect(ocean).not.toHaveCount(0);
    await expect(ocean.first()).toHaveAttribute('aria-label', name);
    await expect(ocean.first()).toHaveCSS('pointer-events', 'auto');
    await expect(ocean.first()).toHaveCSS('cursor', 'pointer');
    const svgBox = await page.locator('.world-map').boundingBox();
    expect(svgBox).not.toBeNull();
    const index = await ocean.evaluateAll(
      (paths, viewport) =>
        paths.findIndex((path) => {
          const box = path.getBoundingClientRect();
          const x = box.x + box.width / 2;
          const y = box.y + box.height / 2;
          return (
            box.width > 0 &&
            box.height > 0 &&
            x >= viewport.x &&
            x <= viewport.x + viewport.width &&
            y >= viewport.y &&
            y <= viewport.y + viewport.height
          );
        }),
      svgBox,
    );
    expect(index).toBeGreaterThanOrEqual(0);
    const representative = ocean.nth(index);
    const box = await representative.boundingBox();
    expect(box).not.toBeNull();
    const point = await representative.evaluate((path) => {
      const length = path.getTotalLength();
      for (let index = 1; index < 10; index += 1) {
        const local = path.getPointAtLength((length * index) / 10);
        const screen = new DOMPoint(local.x, local.y).matrixTransform(
          path.getScreenCTM()!,
        );
        if (
          document
            .elementFromPoint(screen.x, screen.y)
            ?.getAttribute('data-location-id') === path.dataset.locationId
        )
          return { x: screen.x, y: screen.y };
      }
      return null;
    });
    expect(point).not.toBeNull();
    await page.mouse.move(point!.x, point!.y);
    await page.mouse.click(point!.x, point!.y);
  }
});

test('land clicks are not intercepted by the ocean background', async ({
  page,
}) => {
  await page.goto(diagnosticsUrl('africa'));
  const land = page.locator(
    '.active-fill path[data-location-id="world:africa"]',
  );
  await expect(land).not.toHaveCount(0);
  const point = await page.evaluate(() => {
    for (const path of document.querySelectorAll<SVGPathElement>(
      '.active-fill path[data-location-id="world:africa"]',
    )) {
      const bounds = path.getBoundingClientRect();
      for (let column = 1; column < 10; column += 1) {
        for (let row = 1; row < 10; row += 1) {
          const x = bounds.left + (bounds.width * column) / 10;
          const y = bounds.top + (bounds.height * row) / 10;
          if (
            document
              .elementFromPoint(x, y)
              ?.getAttribute('data-location-id') === 'world:africa'
          )
            return { x, y };
        }
      }
    }
    return null;
  });
  expect(point).not.toBeNull();
  const hit = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return {
      id: element?.getAttribute('data-location-id'),
      className: element?.getAttribute('class'),
    };
  }, point!);
  expect(hit).toEqual({ id: 'world:africa', className: 'land-location' });
  await page.mouse.click(point!.x, point!.y);
});

test('continent coastlines are rendered without authored mask seams', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [slug, name] of continentCases) {
    await page.goto(diagnosticsUrl(slug));
    const continent = page.locator(
      `.active-fill path[data-location-id="world:${slug}"]`,
    );
    await expect(continent.first()).toHaveAttribute('aria-label', name);
    const seamSegments = await continent.evaluateAll((paths) => {
      const authoredSeams = new Set([
        '600,212',
        '600,324',
        '960,212',
        '960,324',
        '1284,324',
      ]);
      return paths.reduce(
        (count, path) =>
          count +
          [
            ...path
              .getAttribute('d')!
              .matchAll(/(?:M|L)(-?\d+(?:\.\d+)?),(-?\d+)/g),
          ].filter(([, x, y]) => authoredSeams.has(`${x},${y}`)).length,
        0,
      );
    });
    expect(seamSegments, `${name} authored mask seam vertices`).toBe(0);
  }
});

test('the rendered base ocean is visibly blue', async ({ page }) => {
  await page.goto(diagnosticsUrl('africa'));
  const ocean = page.locator('rect.ocean');
  await expect(ocean).toBeVisible();
  const color = await ocean.evaluate(
    (element) => getComputedStyle(element).fill,
  );
  const channels = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)/);
  expect(channels).not.toBeNull();
  const [, red, green, blue] = channels!.map(Number);
  expect(blue).toBeGreaterThan(red);
  expect(blue).toBeGreaterThan(green);
});

test('World map evidence is captured at wide and mobile sizes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(diagnosticsUrl('africa'));
  await expect(page.locator('.world-map')).toBeVisible();
  await page.screenshot({
    path: 'evidence/world-map-wide.png',
    fullPage: true,
  });

  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page.locator('.world-map')).toBeVisible();
  await page.screenshot({
    path: 'evidence/world-map-mobile.png',
    fullPage: true,
  });
});

test('Pacific representatives resolve at both wrapped map edges', async ({
  page,
}) => {
  await page.goto(diagnosticsUrl('pacific-ocean'));
  const ocean = page.locator(
    '.active-fill path[data-location-id="world:pacific-ocean"]',
  );
  const svgBox = await page.locator('.world-map').boundingBox();
  expect(svgBox).not.toBeNull();
  const boxes = await ocean.evaluateAll((paths) =>
    paths
      .map((path) => {
        const box = path.getBoundingClientRect();
        return { x: box.x, right: box.right, y: box.y, bottom: box.bottom };
      })
      .filter((box) => box.right > box.x && box.bottom > box.y),
  );
  expect(boxes.length).toBeGreaterThan(1);
  const west = boxes.reduce((a, b) => (a.x < b.x ? a : b));
  const east = boxes.reduce((a, b) => (a.right > b.right ? a : b));
  expect(west.x).toBeLessThan(svgBox!.x + 8);
  expect(east.right).toBeGreaterThan(svgBox!.x + svgBox!.width - 8);
  for (const box of [west, east]) {
    const hit = await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.getAttribute('data-location-id'),
      {
        x: Math.max(
          svgBox!.x + 2,
          Math.min(svgBox!.x + svgBox!.width - 2, (box.x + box.right) / 2),
        ),
        y: (box.y + box.bottom) / 2,
      },
    );
    expect(hit).toBe('world:pacific-ocean');
  }
});

test('water hover, selected, and correct states retain water semantics', async ({
  page,
}) => {
  await page.goto(diagnosticsUrl('indian-ocean'));
  const water = page
    .locator('.active-fill path[data-location-id="world:indian-ocean"]')
    .first();
  await expect(water).toHaveClass(/water-location/);
  const box = await water.boundingBox();
  expect(box).not.toBeNull();
  await water.hover({ position: { x: box!.width / 2, y: box!.height / 2 } });
  await expect(water).toHaveCSS('filter', 'brightness(1.2)');
  await expect(water).toHaveCSS('fill', 'rgb(52, 211, 153)');
  await page.getByLabel('Location name').fill('Indian Ocean');
  await page.getByRole('button', { name: 'Submit answer' }).click();
  await expect(page.getByText('Correct. Next location.')).toBeVisible();
  await expect(page.locator('.active-player')).toHaveClass(
    /attempts-remaining-3/,
  );
});
