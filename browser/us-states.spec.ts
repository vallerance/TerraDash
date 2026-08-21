import { expect, test } from '@playwright/test';

const stateIds = [
  'US-AL',
  'US-AK',
  'US-AZ',
  'US-AR',
  'US-CA',
  'US-CO',
  'US-CT',
  'US-DE',
  'US-FL',
  'US-GA',
  'US-HI',
  'US-ID',
  'US-IL',
  'US-IN',
  'US-IA',
  'US-KS',
  'US-KY',
  'US-LA',
  'US-ME',
  'US-MD',
  'US-MA',
  'US-MI',
  'US-MN',
  'US-MS',
  'US-MO',
  'US-MT',
  'US-NE',
  'US-NV',
  'US-NH',
  'US-NJ',
  'US-NM',
  'US-NY',
  'US-NC',
  'US-ND',
  'US-OH',
  'US-OK',
  'US-OR',
  'US-PA',
  'US-RI',
  'US-SC',
  'US-SD',
  'US-TN',
  'US-TX',
  'US-UT',
  'US-VT',
  'US-VA',
  'US-WA',
  'US-WV',
  'US-WI',
  'US-WY',
] as const;

for (const viewport of [
  { name: 'wide', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`keeps Alaska and Hawaii visible at true positions on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    for (const [id, name] of [
      ['US-AK', 'Alaska'],
      ['US-HI', 'Hawaii'],
    ]) {
      await page.goto(`/TerraDash/diagnostics.html?location=${id}`);
      const map = page.locator('.regional-map');
      await expect(map).toHaveAttribute('viewBox', '10 35 500 295');
      const state = map
        .locator(`.active-fill > path[data-location-id="${id}"]`)
        .first();
      await expect(state).toHaveAttribute('aria-label', name);
      await expect(state).toBeVisible();
      const box = await state.boundingBox();
      expect(box?.width).toBeGreaterThan(0);
      expect(box?.height).toBeGreaterThan(0);
      await state.click();
    }
  });
}

test('keeps every active state inside the regional viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const id of stateIds) {
    await page.goto(`/TerraDash/diagnostics.html?location=${id}`);
    const map = page.locator('.regional-map');
    const mapBox = await map.boundingBox();
    const state = map
      .locator(`.active-fill path[data-location-id="${id}"]`)
      .first();
    const stateBox = await state.boundingBox();
    expect(mapBox, id).not.toBeNull();
    expect(stateBox, id).not.toBeNull();
    expect(stateBox!.x + stateBox!.width).toBeGreaterThan(mapBox!.x);
    expect(stateBox!.x).toBeLessThan(mapBox!.x + mapBox!.width);
    expect(stateBox!.y + stateBox!.height).toBeGreaterThan(mapBox!.y);
    expect(stateBox!.y).toBeLessThan(mapBox!.y + mapBox!.height);
  }
});

test('identifies a visible state and advances the US States quiz', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1777, height: 1171 });
  await page.goto('/TerraDash/?quiz=us-states&start=1');
  const map = page.locator('.regional-map');
  const target = map.locator('.active-fill path[data-location-id]').first();
  const targetId = await target.getAttribute('data-location-id');
  const targetName = await target.getAttribute('aria-label');
  const mapBox = await map.boundingBox();
  const targetBox = await target.boundingBox();
  expect(targetId).toMatch(/^US-[A-Z]{2}$/);
  expect(targetName).toBeTruthy();
  expect(mapBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  expect(targetBox!.x + targetBox!.width).toBeGreaterThan(mapBox!.x);
  expect(targetBox!.x).toBeLessThan(mapBox!.x + mapBox!.width);
  expect(targetBox!.y + targetBox!.height).toBeGreaterThan(mapBox!.y);
  expect(targetBox!.y).toBeLessThan(mapBox!.y + mapBox!.height);

  const input = page.getByRole('combobox', { name: 'Location name' });
  await input.fill(targetName!);
  await page.getByRole('option', { name: targetName!, exact: true }).click();
  await page.getByRole('button', { name: 'Submit answer' }).click();
  await expect(page.locator('.status-correct strong')).toHaveText('1/1');
  await expect(page.locator('.status-remaining strong')).toHaveText('49');
  await page.screenshot({
    path: testInfo.outputPath('us-states-visible-target-1777x1171.png'),
    fullPage: true,
  });
});

test('regional submenu is keyboard accessible and viewport-contained', async ({
  page,
}) => {
  await page.goto('/TerraDash/');
  const trigger = page.getByRole('button', { name: /Quizzes/ });
  await trigger.click();
  const regional = page.getByRole('menuitem', { name: 'Regional quizzes' });
  await regional.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('menu').last()).toBeVisible();
  await expect(page.getByRole('menu').last().getByRole('menuitem')).toHaveText([
    'US States',
  ]);
});

for (const viewport of [
  { name: 'wide', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`captures the complete US States map on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto('/TerraDash/?quiz=us-states&start=1');
    await expect(page.locator('.active-player')).toBeVisible();
    const map = page.locator('.regional-map');
    await expect(map).toHaveAttribute('viewBox', '10 35 500 295');
    await expect(map.locator('.regional-state-borders > g')).toHaveCount(50);
    await page.screenshot({
      path: testInfo.outputPath(`us-states-${viewport.name}.png`),
      fullPage: true,
    });
  });
}
