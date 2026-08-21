import { expect, test } from '@playwright/test';

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

test('keeps the reported wide US States composition inside its layout bands', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1777, height: 1171 });
  await page.goto('/TerraDash/?quiz=us-states&start=1');
  await expect(page.locator('.active-player')).toBeVisible();

  const player = page.locator('.active-player');
  const header = player.locator('.quiz-header');
  const prompt = player.locator('.quiz-prompt-group');
  const status = player.locator('.quiz-status-bar');
  const stage = player.locator('.map-stage');
  const frame = player.locator('.map-frame');
  const answer = player.locator('.answer-panel');
  const footer = page.locator('.app-footer');
  const [
    playerBox,
    headerBox,
    promptBox,
    statusBox,
    stageBox,
    frameBox,
    answerBox,
    footerBox,
  ] = await Promise.all([
    player.boundingBox(),
    header.boundingBox(),
    prompt.boundingBox(),
    status.boundingBox(),
    stage.boundingBox(),
    frame.boundingBox(),
    answer.boundingBox(),
    footer.boundingBox(),
  ]);

  expect(playerBox).not.toBeNull();
  expect(headerBox).not.toBeNull();
  expect(promptBox).not.toBeNull();
  expect(statusBox).not.toBeNull();
  expect(stageBox).not.toBeNull();
  expect(frameBox).not.toBeNull();
  expect(answerBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect(promptBox!.height).toBeGreaterThan(0);
  expect(statusBox!.height).toBeGreaterThan(0);
  expect(headerBox!.y + headerBox!.height).toBeLessThanOrEqual(stageBox!.y + 1);
  expect(frameBox!.y).toBeGreaterThanOrEqual(stageBox!.y - 1);
  expect(frameBox!.y + frameBox!.height).toBeLessThanOrEqual(
    stageBox!.y + stageBox!.height + 1,
  );
  expect(frameBox!.height).toBeLessThanOrEqual(stageBox!.height + 1);
  expect(stageBox!.y + stageBox!.height).toBeLessThanOrEqual(footerBox!.y + 1);
  expect(stageBox!.x).toBeGreaterThanOrEqual(-1);
  expect(stageBox!.x + stageBox!.width).toBeLessThanOrEqual(1778);
  expect(answerBox!.x).toBeGreaterThanOrEqual(stageBox!.x - 1);
  expect(answerBox!.x + answerBox!.width).toBeLessThanOrEqual(
    stageBox!.x + stageBox!.width + 1,
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(1777);

  const map = page.locator('.regional-map');
  await expect(map).toHaveAttribute('viewBox', '10 35 500 295');
  await expect(map.locator('.regional-state-borders > g')).toHaveCount(50);
  await page.screenshot({
    path: testInfo.outputPath('us-states-layout-1777x1171.png'),
    fullPage: true,
  });
});

for (const viewport of [
  { name: 'wide', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`keeps the active regional composition visible on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto('/TerraDash/?quiz=us-states&start=1');

    const player = page.locator('.active-player');
    await expect(player).toBeVisible();
    await expect(player.locator('.quiz-prompt-group')).toBeVisible();
    await expect(player.locator('.quiz-status-bar')).toBeVisible();
    await expect(player.locator('.map-stage')).toBeVisible();
    await expect(player.locator('.answer-panel')).toBeVisible();
    await expect(page.locator('.app-footer')).toBeVisible();

    const boxes = await Promise.all(
      [
        '.quiz-header',
        '.map-stage',
        '.map-frame',
        '.answer-panel',
        '.app-footer',
      ].map((selector) => page.locator(selector).boundingBox()),
    );
    const [header, stage, frame, answer, footer] = boxes;
    for (const box of boxes) expect(box).not.toBeNull();
    expect(header!.y + header!.height).toBeLessThanOrEqual(stage!.y + 1);
    expect(frame!.y).toBeGreaterThanOrEqual(stage!.y - 1);
    expect(frame!.y + frame!.height).toBeLessThanOrEqual(
      stage!.y + stage!.height + 1,
    );
    expect(stage!.y + stage!.height).toBeLessThanOrEqual(footer!.y + 1);
    expect(answer!.x).toBeGreaterThanOrEqual(stage!.x - 1);
    expect(answer!.x + answer!.width).toBeLessThanOrEqual(
      stage!.x + stage!.width + 1,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({
      path: testInfo.outputPath(`us-states-layout-after-${viewport.name}.png`),
      fullPage: true,
    });
  });
}

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
