import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 375, height: 667 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
]) {
  test(`renders the west edge at 127W at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/TerraDash/');
    await page.getByRole('button', { name: 'World UN Countries' }).click();
    await page
      .getByRole('button', { name: 'Start World UN Countries' })
      .click();
    const measurement = await page.locator('svg.world-map').evaluate((svg) => {
      const viewBox = svg.viewBox.baseVal;
      const bounds = svg.getBoundingClientRect();
      const matrix = svg.getScreenCTM()!;
      const inverse = matrix.inverse();
      const rightScreenX =
        matrix.a * (viewBox.x + viewBox.width) +
        matrix.c * viewBox.y +
        matrix.e;
      const rightScreenY =
        matrix.b * (viewBox.x + viewBox.width) +
        matrix.d * viewBox.y +
        matrix.f;
      const rightMapX =
        inverse.a * rightScreenX + inverse.c * rightScreenY + inverse.e;
      const mapWidth = 1440;
      const rightLongitude = (rightMapX / mapWidth) * 360 - 180;
      const renderedPaths = [...svg.querySelectorAll('g.countries path')]
        .map((path) => {
          const box = path.getBoundingClientRect();
          return { left: box.left, right: box.right };
        })
        .filter(({ right }) => right >= bounds.right - 1);
      return {
        viewBox: [viewBox.x, viewBox.width],
        screenRight: rightScreenX,
        svgRight: bounds.right,
        rightLongitude,
        renderedPathCountAtRightEdge: renderedPaths.length,
      };
    });
    console.log(JSON.stringify({ viewport, measurement }));

    expect(measurement.viewBox).toEqual([-1428, 1640]);
    expect(measurement.rightLongitude).toBeCloseTo(-127, 6);
    expect(measurement.renderedPathCountAtRightEdge).toBeGreaterThan(0);
  });
}
