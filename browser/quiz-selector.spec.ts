import { expect, test } from '@playwright/test';

const quizNames = [
  'World UN Countries',
  'Africa UN Countries',
  'Asia UN Countries',
  'Europe UN Countries',
  'North America UN Countries',
  'South America UN Countries',
  'Oceania UN Countries',
  'Caribbean UN Countries',
];
const nonUnTitle =
  'Non-UN Countries, Independent Territories, and Autonomous Regions';

test('header navbar exposes all quizzes and enters the selected quiz', async ({
  page,
}) => {
  await page.goto('/TerraDash/');
  const navbar = page.getByRole('navigation', { name: 'Quizzes' });
  const links = navbar.getByRole('link');
  await expect(links).toHaveText(
    quizNames
      .map((name) => name.replace(' UN Countries', ''))
      .concat(nonUnTitle),
  );
  await expect(page.locator('.quiz-option')).toHaveCount(9);
  await expect(page.locator('.quiz-option-thumbnail')).toHaveCount(9);
  const descriptions = [
    'All UN Member and UN Observer states',
    'UN Member and UN Observer states in Africa',
    'UN Member and UN Observer states in Asia',
    'UN Member and UN Observer states in Europe',
    'UN Member and UN Observer states in North America',
    'UN Member and UN Observer states in South America',
    'UN Member and UN Observer states in Oceania',
    'UN Member and UN Observer states in Caribbean',
  ];
  for (const [index, description] of descriptions.entries()) {
    await expect(
      page.locator('.quiz-option-description').nth(index),
    ).toHaveText(description);
  }
  await expect(page.locator('.quiz-option-description').nth(8)).toHaveText(
    'Non-UN Countries and regions listed in ISO 3166-1, UN M49, the List of Economies published by the World Bank Group, or under select categories in ISO 3166-2.',
  );
  await expect(
    page.getByText(
      /Identify all .* locations with three attempts per location/,
    ),
  ).toHaveCount(0);
  await links.filter({ hasText: /^Asia$/ }).click();
  await expect(page).toHaveURL(/\?quiz=asia$/);
  await expect(navbar.getByRole('link', { name: 'Asia' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('button', { name: 'Start quiz' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Asia UN Countries' }).click();
  const dialog = page.getByRole('dialog', { name: 'Asia UN Countries' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('48 locations')).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Start Asia UN Countries Quiz' })
    .click();
  await expect(page.locator('.active-player .quiz-name')).toHaveText(
    'Asia UN Countries',
  );
});

test('selects and starts the non-UN quiz', async ({ page }) => {
  await page.goto('/TerraDash/');
  const title = nonUnTitle;
  await page.getByRole('button', { name: title }).click();
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('101 locations')).toBeVisible();
  await expect(
    dialog.getByText(
      'Non-UN Countries and regions listed in ISO 3166-1, UN M49, the List of Economies published by the World Bank Group, or under select categories in ISO 3166-2.',
    ),
  ).toBeVisible();
  await expect(dialog.locator('em')).toHaveText(
    'Countries and regions listed in ISO 3166-1, UN M49, the List of Economies published by the World Bank Group, or under select categories in ISO 3166-2.',
  );
  await page.goto('/TerraDash/?quiz=non-un&start=1');
  await expect(page.locator('.active-player .quiz-name')).toHaveText(title);
});

test('colors custom geometry in the main map and magnified copy as attempts change', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
  await page.goto('/TerraDash/?quiz=non-un&start=1');
  await expect(page.locator('.callout-selected path')).not.toHaveCount(0);

  for (const selector of ['.active-fill path', '.callout-selected path']) {
    await expect
      .poll(() =>
        page
          .locator(selector)
          .evaluateAll(
            (paths) =>
              paths.length > 0 &&
              paths.every(
                (path) => getComputedStyle(path).fill === 'rgb(52, 211, 153)',
              ),
          ),
      )
      .toBe(true);
  }

  const input = page.getByRole('combobox', { name: 'Location name' });
  await input.fill('Adj');
  await page.getByRole('option', { name: 'Adjara' }).click();
  await page.getByRole('button', { name: 'Submit answer' }).click();

  for (const selector of ['.active-fill path', '.callout-selected path']) {
    await expect
      .poll(() =>
        page
          .locator(selector)
          .evaluateAll(
            (paths) =>
              paths.length > 0 &&
              paths.every(
                (path) => getComputedStyle(path).fill === 'rgb(250, 204, 21)',
              ),
          ),
      )
      .toBe(true);
  }
});

test('autocomplete only exposes locations in the active quiz', async ({
  page,
}) => {
  await page.goto('/TerraDash/?quiz=asia');
  await page.getByRole('button', { name: 'Asia UN Countries' }).click();
  await page
    .getByRole('button', { name: 'Start Asia UN Countries Quiz' })
    .click();

  const input = page.getByRole('combobox', { name: 'Location name' });
  await input.fill('Albania');
  await expect(page.getByRole('option', { name: 'Albania' })).toHaveCount(0);
  await input.fill('Afghan');
  await expect(page.getByRole('option', { name: 'Afghanistan' })).toBeVisible();
});

test('mobile navigation scrolls to and reaches the final quiz', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/TerraDash/');
  const mobileNav = page.getByRole('navigation', { name: 'Quizzes' });
  await mobileNav.evaluate((nav) => {
    nav.scrollLeft = nav.scrollWidth;
  });
  await mobileNav.getByRole('link', { name: 'Non-UN' }).click();
  await expect(page).toHaveURL(/\/TerraDash\/\?quiz=non-un$/);
  await expect(mobileNav.getByRole('link', { name: 'Non-UN' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('home composition captures wide and mobile surfaces', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/TerraDash/');
  const wideBounds = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>('#start-title')!;
    const grid = document.querySelector<HTMLElement>('.quiz-options')!;
    const navigation = document.querySelector<HTMLElement>('.quiz-navigation')!;
    const finalLink = navigation.querySelector<HTMLElement>('a:last-child')!;
    return {
      heroLeft: hero.getBoundingClientRect().left,
      gridLeft: grid.getBoundingClientRect().left,
      gridWidth: grid.getBoundingClientRect().width,
      pageScrollWidth: document.documentElement.scrollWidth,
      pageClientWidth: document.documentElement.clientWidth,
      finalLinkRight: finalLink.getBoundingClientRect().right,
      navigationRight: navigation.getBoundingClientRect().right,
    };
  });
  expect(wideBounds.heroLeft).toBe(wideBounds.gridLeft);
  expect(wideBounds.gridWidth).toBeGreaterThan(900);
  expect(wideBounds.pageScrollWidth).toBeLessThanOrEqual(
    wideBounds.pageClientWidth,
  );
  expect(wideBounds.finalLinkRight).toBeLessThanOrEqual(
    wideBounds.navigationRight,
  );
  await page.screenshot({
    path: testInfo.outputPath('home-wide.png'),
    fullPage: true,
  });

  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/TerraDash/');
  const mobileBounds = await page.evaluate(() => ({
    gridWidth: document
      .querySelector<HTMLElement>('.quiz-options')!
      .getBoundingClientRect().width,
    viewport: innerWidth,
    minCardWidth: Math.min(
      ...[...document.querySelectorAll<HTMLElement>('.quiz-option')].map(
        (card) => card.getBoundingClientRect().width,
      ),
    ),
    pageScrollWidth: document.documentElement.scrollWidth,
    pageClientWidth: document.documentElement.clientWidth,
  }));
  expect(mobileBounds.gridWidth).toBeLessThanOrEqual(mobileBounds.viewport);
  expect(mobileBounds.minCardWidth).toBeGreaterThanOrEqual(140);
  expect(mobileBounds.pageScrollWidth).toBeLessThanOrEqual(
    mobileBounds.pageClientWidth,
  );
  await page.screenshot({
    path: testInfo.outputPath('home-mobile.png'),
    fullPage: true,
  });
});
