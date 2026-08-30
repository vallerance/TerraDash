import { expect, test } from '@playwright/test';

const oceanCases = [
  ['arctic-ocean', 'Arctic Ocean'],
  ['atlantic-ocean', 'Atlantic Ocean'],
  ['indian-ocean', 'Indian Ocean'],
  ['pacific-ocean', 'Pacific Ocean'],
  ['southern-ocean', 'Southern Ocean'],
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
    const box = await ocean.first().boundingBox();
    expect(box).not.toBeNull();
    const hit = await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.getAttribute('data-location-id'),
      {
        x: box!.x + box!.width / 2,
        y: box!.y + box!.height / 2,
      },
    );
    expect(hit).toBe(`world:${slug}`);
    await ocean
      .first()
      .hover({ position: { x: box!.width / 2, y: box!.height / 2 } });
    await ocean
      .first()
      .click({ position: { x: box!.width / 2, y: box!.height / 2 } });
  }
});

test('land clicks are not intercepted by the ocean background', async ({
  page,
}) => {
  await page.goto(diagnosticsUrl('africa'));
  const land = page
    .locator('.active-fill path[data-location-id="world:africa"]')
    .first();
  const box = await land.boundingBox();
  expect(box).not.toBeNull();
  const hit = await page.evaluate(
    ({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return {
        id: element?.getAttribute('data-location-id'),
        className: element?.getAttribute('class'),
      };
    },
    { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
  );
  expect(hit).toEqual({ id: 'world:africa', className: 'land-location' });
  await land.click({ position: { x: box!.width / 2, y: box!.height / 2 } });
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
  expect(east.right).toBeGreaterThan(svgBox!.right - 8);
  for (const box of [west, east]) {
    const hit = await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.getAttribute('data-location-id'),
      {
        x: (box.x + box.right) / 2,
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
  await expect(water).toHaveCSS('fill', 'rgb(245, 158, 11)');
  await expect(page.locator('.callout-selected path').first()).toHaveCSS(
    'fill',
    'rgb(245, 158, 11)',
  );
  await page.getByLabel('Location name').fill('Indian Ocean');
  await page.getByRole('button', { name: 'Submit answer' }).click();
  await expect(page.getByText('Correct. Next location.')).toBeVisible();
  await expect(page.locator('.active-player')).toHaveClass(
    /attempts-remaining-3/,
  );
});
