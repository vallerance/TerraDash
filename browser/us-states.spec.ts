import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const generatedMap = JSON.parse(
  readFileSync(new URL('../data/generated/map.json', import.meta.url), 'utf8'),
);
const usQuiz = JSON.parse(
  readFileSync(new URL('../data/quizzes.json', import.meta.url), 'utf8'),
).find((quiz: { id: string }) => quiz.id === 'us-states');
const regionalMenuLabels = JSON.parse(
  readFileSync(new URL('../data/quizzes.json', import.meta.url), 'utf8'),
)
  .filter((quiz: { category?: string }) => quiz.category === 'regional')
  .map((quiz: { menuLabel: string }) => quiz.menuLabel);
const expectedContextFeatureCount =
  generatedMap.sourceFeatureIds.length -
  (usQuiz.map.contextFeatureExclusions?.length ?? 0);

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
      const map = page.locator('.world-map');
      await expect(map).toHaveAttribute(
        'viewBox',
        '-100 35 671.9444444444445 295',
      );
      await expect(map).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
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

function hasProperCrossing(path: string): boolean {
  const orientation = (
    a: [number, number],
    b: [number, number],
    c: [number, number],
  ) => {
    const value = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    return Math.abs(value) < Number.EPSILON ? 0 : value > 0 ? 1 : -1;
  };
  return [...path.matchAll(/M[^MZ]*Z/g)].some((subpath) => {
    const points = [...subpath[0].matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(
      ([, x, y]) => [+x, +y] as [number, number],
    );
    for (let left = 0; left < points.length; left++) {
      const a = points[left];
      const b = points[(left + 1) % points.length];
      for (let right = left + 1; right < points.length; right++) {
        if (right === left + 1 || (left === 0 && right === points.length - 1))
          continue;
        const c = points[right];
        const d = points[(right + 1) % points.length];
        if (
          orientation(a, b, c) * orientation(a, b, d) < 0 &&
          orientation(c, d, a) * orientation(c, d, b) < 0
        )
          return true;
      }
    }
    return false;
  });
}

for (const viewport of [
  { name: 'wide', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  for (const [id, name] of [
    ['US-MI', 'Michigan'],
    ['US-WI', 'Wisconsin'],
  ]) {
    test(`captures ${name} topology in main map and magnifier on ${viewport.name}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.goto(`/TerraDash/diagnostics.html?location=${id}`);
      const map = page.locator('.world-map');
      const mainPaths = await map
        .locator(`.active-fill path[data-location-id="${id}"]`)
        .evaluateAll((paths) => paths.map((path) => path.getAttribute('d')));
      const insetPaths = await map
        .locator('.callout-inset .callout-selected path')
        .evaluateAll((paths) => paths.map((path) => path.getAttribute('d')));
      await page.screenshot({
        path: testInfo.outputPath(
          `${id.toLowerCase()}-geometry-${viewport.name}.png`,
        ),
        fullPage: true,
      });
      expect(mainPaths, `${id} main paths`).not.toHaveLength(0);
      if (viewport.name === 'mobile')
        expect(insetPaths, `${id} mobile inset paths`).not.toHaveLength(0);
      if (id === 'US-MI') {
        expect(mainPaths, `${id} main multipart paths`).toHaveLength(105);
        const mainYs = mainPaths.flatMap((path) =>
          [...(path ?? '').matchAll(/[ML]-?[\d.]+,(-?[\d.]+)/g)].map(([, y]) =>
            Number(y),
          ),
        );
        expect(Math.min(...mainYs), `${id} UP coverage`).toBeLessThan(170);
        expect(Math.max(...mainYs), `${id} LP coverage`).toBeGreaterThan(190);
        if (viewport.name === 'mobile')
          expect(insetPaths, `${id} inset multipart paths`).toHaveLength(105);
      }
      expect(
        [...mainPaths, ...insetPaths].some(
          (path): path is string => Boolean(path) && hasProperCrossing(path),
        ),
        `${id} must not contain an artificial crossing segment`,
      ).toBe(false);
    });
  }
}

const stateIds = [
  'US-AL',
  'US-AK',
  'US-AZ',
  'US-AR',
  'US-CA',
  'US-CO',
  'US-CT',
  'US-DE',
  'US-DC',
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

test('keeps every active state inside the regional viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/TerraDash/diagnostics.html?location=US-AL');
  const select = page.locator('.diagnostics-control select');
  for (const id of stateIds) {
    await select.selectOption(id);
    const map = page.locator('.world-map');
    const mapBox = await map.boundingBox();
    const stateBox = await map
      .locator(`.active-fill path[data-location-id="${id}"]`)
      .first()
      .boundingBox();
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
  const map = page.locator('.world-map');
  const target = map.locator('.active-fill path[data-location-id]').first();
  const targetName = await target.getAttribute('aria-label');
  const mapBox = await map.boundingBox();
  const targetBox = await target.boundingBox();
  expect(await target.getAttribute('data-location-id')).toMatch(
    /^US-[A-Z]{2}$/,
  );
  expect(targetName).toBeTruthy();
  expect(mapBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  expect(targetBox!.x + targetBox!.width).toBeGreaterThan(mapBox!.x);
  expect(targetBox!.x).toBeLessThan(mapBox!.x + mapBox!.width);
  expect(targetBox!.y + targetBox!.height).toBeGreaterThan(mapBox!.y);
  expect(targetBox!.y).toBeLessThan(mapBox!.y + mapBox!.height);
  await page.getByRole('combobox', { name: 'Location name' }).fill(targetName!);
  await page.getByRole('button', { name: 'Submit answer' }).click();
  await expect(page.locator('.status-correct strong')).toHaveText('1/1');
  await expect(page.locator('.status-remaining strong')).toHaveText('50');
  await page.screenshot({
    path: testInfo.outputPath('us-states-visible-target-1777x1171.png'),
    fullPage: true,
  });
});

test('renders shared tiny-state callout geometry and attempt colors at wide viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1777, height: 1171 });
  await page.goto('/TerraDash/diagnostics.html?location=US-RI');
  const map = page.locator('.world-map');
  await expect(map.locator('.map-callout')).toBeVisible();
  await expect(map.locator('.callout-selected')).toBeVisible();

  const colors = await page.evaluate(() => {
    const player = document.querySelector('.active-player')!;
    const selected = document.querySelector<SVGElement>(
      '.callout-selected path',
    )!;
    player.classList.add('attempts-remaining-2');
    const secondAttempt = getComputedStyle(selected).fill;
    player.classList.remove('attempts-remaining-2');
    player.classList.add('attempts-remaining-1');
    const finalAttempt = getComputedStyle(selected).fill;
    return { secondAttempt, finalAttempt };
  });
  expect(colors).toEqual({
    secondAttempt: 'rgb(250, 204, 21)',
    finalAttempt: 'rgb(248, 113, 113)',
  });
});

for (const viewport of [
  { name: 'wide', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`keeps context and RI magnifier visible on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/TerraDash/diagnostics.html?location=US-RI');
    const map = page.locator('.world-map');
    await expect(map.locator('.countries .country')).toHaveCount(
      expectedContextFeatureCount,
    );
    for (const id of ['ne:1159320467', 'ne:1159321055']) {
      const feature = map.locator(`[data-feature-id="${id}"]`);
      await expect(feature).toBeVisible();
      const box = await feature.boundingBox();
      expect(box?.width, id).toBeGreaterThan(0);
      expect(box?.height, id).toBeGreaterThan(0);
    }
    const callout = map.locator('.callout-inset');
    await expect(callout).toBeVisible();
    await expect(callout.locator('.callout-selected path')).not.toHaveCount(0);
    const selectedBox = await callout
      .locator('.callout-selected path')
      .first()
      .boundingBox();
    const calloutBox = await callout.boundingBox();
    expect(selectedBox).not.toBeNull();
    expect(calloutBox).not.toBeNull();
    expect(selectedBox!.x + selectedBox!.width).toBeGreaterThan(calloutBox!.x);
    expect(selectedBox!.x).toBeLessThan(calloutBox!.x + calloutBox!.width);
    expect(selectedBox!.y + selectedBox!.height).toBeGreaterThan(calloutBox!.y);
    expect(selectedBox!.y).toBeLessThan(calloutBox!.y + calloutBox!.height);
    await page.screenshot({
      path: testInfo.outputPath(`us-states-ri-callout-${viewport.name}.png`),
      fullPage: true,
    });
  });
}

for (const viewport of [
  { name: 'wide', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`captures Massachusetts high-resolution context on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/TerraDash/diagnostics.html?location=US-RI');
    const map = page.locator('.world-map');
    const contextPath = map.locator(
      '.callout-context [data-layer-id="US-MA"] path',
    );
    const mainPath = map.locator(
      '.map-base-layers [data-layer-id="US-MA"] path',
    );
    await expect(map.locator('.callout-inset')).toBeVisible();
    await expect(contextPath).not.toHaveCount(0);
    const [contextData, mainData] = await Promise.all([
      contextPath.first().getAttribute('d'),
      mainPath.first().getAttribute('d'),
    ]);
    expect(contextData).toBeTruthy();
    expect(mainData).toBeTruthy();
    expect(contextData).not.toBe(mainData);
    await page.screenshot({
      path: testInfo.outputPath(`us-states-ma-callout-${viewport.name}.png`),
      fullPage: true,
    });
  });
}

test('keeps shared threshold bypass for large state callout at wide viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1777, height: 1171 });
  await page.goto('/TerraDash/diagnostics.html?location=US-TX');
  await expect(page.locator('.world-map .map-callout')).toHaveCount(0);
  await expect(page.locator('.world-map .callout-selected')).toHaveCount(0);
});

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

  const map = page.locator('.world-map');
  await expect(map).toHaveAttribute('viewBox', '-100 35 671.9444444444445 295');
  await expect(map).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
  await expect(map.locator('.map-base-layers > g')).toHaveCount(51);
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
  const regional = page.getByRole('menuitem', { name: 'States and Provinces' });
  await regional.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('menu').last()).toBeVisible();
  await expect(page.getByRole('menu').last().getByRole('menuitem')).toHaveText(
    regionalMenuLabels,
  );
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
    const map = page.locator('.world-map');
    await expect(map).toHaveAttribute(
      'viewBox',
      '-100 35 671.9444444444445 295',
    );
    await expect(map).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
    await expect(map.locator('.map-base-layers > g')).toHaveCount(51);
    await page.screenshot({
      path: testInfo.outputPath(`us-states-${viewport.name}.png`),
      fullPage: true,
    });
  });
}

test('keeps projected geography separate from magnifier overlay geometry', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/TerraDash/diagnostics.html?location=US-RI');
  const map = page.locator('.world-map');
  const geography = map.locator('.map-projection');
  const callout = map.locator('.map-callout');
  const source = map.locator('.callout-source');
  const cutout = map.locator('.callout-cutout');
  const active = map
    .locator('.active-fill path[data-location-id="US-RI"]')
    .first();
  const magnified = map.locator('.callout-selected path').first();

  await expect(geography).toHaveAttribute('transform', /scale\(1 1\.269/);
  await expect(callout).toBeVisible();
  await expect(source).toBeVisible();
  await expect(cutout).toBeVisible();
  await expect(magnified).toBeVisible();

  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => {
      const box = document
        .querySelector<SVGGraphicsElement>(selector)!
        .getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    const geography = document.querySelector('.map-projection')!;
    const callout = document.querySelector('.map-callout')!;
    return {
      calloutInsideProjection: geography.contains(callout),
      source: rect('.callout-source'),
      cutout: rect('.callout-cutout'),
      active: rect('.active-fill path[data-location-id="US-RI"]'),
      magnified: rect('.callout-selected path'),
    };
  });

  expect(geometry.calloutInsideProjection).toBe(false);
  expect(geometry.source.width).toBeCloseTo(geometry.source.height, 1);
  expect(geometry.cutout.width).toBeCloseTo(geometry.cutout.height, 1);

  const sourceCenter = {
    x: geometry.source.x + geometry.source.width / 2,
    y: geometry.source.y + geometry.source.height / 2,
  };
  const activeCenter = {
    x: geometry.active.x + geometry.active.width / 2,
    y: geometry.active.y + geometry.active.height / 2,
  };
  expect(Math.abs(sourceCenter.x - activeCenter.x)).toBeLessThan(
    geometry.source.width / 2,
  );
  expect(Math.abs(sourceCenter.y - activeCenter.y)).toBeLessThan(
    geometry.source.height / 2,
  );
  expect(geometry.magnified.width).toBeGreaterThan(geometry.active.width * 2);
  expect(geometry.magnified.height).toBeGreaterThan(geometry.active.height * 2);
});
